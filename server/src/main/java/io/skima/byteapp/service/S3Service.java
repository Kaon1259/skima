package io.skima.byteapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

/**
 * AWS S3 이미지 업로드 — 워커 프로필 / 매장 사진.
 * 인증: DefaultCredentialsProvider (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env vars 또는 IAM role).
 * 버킷·리전은 cloud.aws.s3.bucket / cloud.aws.s3.region 설정.
 *
 * 버킷이 비어있으면 비활성 — upload 시 IllegalStateException.
 * application.yml 에서 키 미설정 = 로컬 개발 모드 (S3 미사용 / 사진 업로드 비활성).
 */
@Slf4j
@Service
public class S3Service {

    private final S3Client s3Client;
    private final String bucket;
    private final String region;
    private final boolean enabled;

    public S3Service(@Value("${cloud.aws.s3.bucket:}") String bucket,
                     @Value("${cloud.aws.s3.region:ap-northeast-2}") String region,
                     @Value("${cloud.aws.credentials.access-key:}") String accessKey,
                     @Value("${cloud.aws.credentials.secret-key:}") String secretKey) {
        this.bucket = bucket;
        this.region = region;
        this.enabled = bucket != null && !bucket.isBlank();
        if (this.enabled) {
            // 우선순위: application-local.yml 의 access-key/secret-key → env vars → IAM role
            AwsCredentialsProvider provider;
            if (accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank()) {
                provider = StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
                log.info("S3Service: 자격증명 = application-local.yml (Static)");
            } else {
                provider = DefaultCredentialsProvider.create();
                log.info("S3Service: 자격증명 = DefaultCredentialsProvider (env vars / profile / IAM role)");
            }
            this.s3Client = S3Client.builder()
                    .region(Region.of(region))
                    .credentialsProvider(provider)
                    .build();
            log.info("S3Service enabled — bucket={} region={}", bucket, region);
        } else {
            this.s3Client = null;
            log.warn("S3Service disabled — cloud.aws.s3.bucket 미설정. 이미지 업로드 endpoint 가 503 반환");
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * 이미지를 S3에 업로드하고 공개 URL을 반환.
     * @param prefix S3 key prefix (예: "users/profile", "cafes/cover")
     */
    public String upload(MultipartFile file, String prefix) throws IOException {
        if (!enabled) {
            throw new IllegalStateException("S3 업로드가 비활성화 상태입니다 (서버 환경변수 미설정)");
        }
        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf(".")).toLowerCase();
        }
        String key = prefix + "/" + UUID.randomUUID() + ext;

        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(file.getContentType())
                .build();

        try (InputStream is = file.getInputStream()) {
            s3Client.putObject(putRequest,
                    RequestBody.fromInputStream(is, file.getSize()));
        }

        String url = "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
        log.info("S3 업로드 완료: {} ({} bytes)", url, file.getSize());
        return url;
    }

    /** S3에서 이미지 삭제 (URL에서 key 추출). 실패해도 throw 안 함. */
    public void delete(String imageUrl) {
        if (!enabled || imageUrl == null || !imageUrl.contains(".amazonaws.com/")) return;
        try {
            String key = imageUrl.substring(imageUrl.indexOf(".amazonaws.com/") + ".amazonaws.com/".length());
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build());
            log.info("S3 삭제 완료: {}", key);
        } catch (Exception e) {
            log.warn("S3 삭제 실패: {}", e.getMessage());
        }
    }
}
