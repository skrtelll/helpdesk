FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY gradlew settings.gradle.kts build.gradle.kts gradle.properties ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon > /dev/null

COPY src ./src
RUN ./gradlew bootJar --no-daemon \
 && java -Djarmode=tools -jar build/libs/*.jar extract --layers --launcher --destination extracted

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S helpdesk && adduser -S helpdesk -G helpdesk
COPY --from=build --chown=helpdesk:helpdesk /workspace/extracted/dependencies/ ./
COPY --from=build --chown=helpdesk:helpdesk /workspace/extracted/spring-boot-loader/ ./
COPY --from=build --chown=helpdesk:helpdesk /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build --chown=helpdesk:helpdesk /workspace/extracted/application/ ./
USER helpdesk

ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"

EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
