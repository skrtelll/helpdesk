FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle ./gradle
COPY src ./src

RUN chmod +x gradlew && ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S helpdesk && adduser -S helpdesk -G helpdesk
COPY --from=build /workspace/build/libs/*.jar app.jar
RUN chown helpdesk:helpdesk app.jar
USER helpdesk

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
