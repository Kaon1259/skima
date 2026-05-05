# Skima Byte server — Spring Boot 3.5 / Java 17 / Maven
# Railway 가 자동 감지하지만 명시적으로 작성해 빌드 캐시 효율 + JRE 슬림화

FROM eclipse-temurin:17-jdk AS builder
WORKDIR /workspace

# 의존성만 먼저 캐시 (POM 변경 없으면 dependency download 스킵)
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw -B -DskipTests dependency:go-offline

COPY src src
RUN ./mvnw -B -DskipTests package

# 런타임 — JRE 만 (이미지 작게)
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /workspace/target/*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_OPTS=""

# Railway 가 PORT env 주입. Spring 이 ${PORT} 로 읽음.
EXPOSE 8090

ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
