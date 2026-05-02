package io.skima.byteapp.common;

import org.springframework.http.HttpStatus;

public class BusinessException extends RuntimeException {

    private final HttpStatus status;

    public BusinessException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static BusinessException badRequest(String msg) {
        return new BusinessException(HttpStatus.BAD_REQUEST, msg);
    }

    public static BusinessException notFound(String msg) {
        return new BusinessException(HttpStatus.NOT_FOUND, msg);
    }

    public static BusinessException conflict(String msg) {
        return new BusinessException(HttpStatus.CONFLICT, msg);
    }

    public static BusinessException forbidden(String msg) {
        return new BusinessException(HttpStatus.FORBIDDEN, msg);
    }
}
