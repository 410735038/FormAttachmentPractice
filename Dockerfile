FROM node:22-alpine AS frontend-build
WORKDIR /workspace/src/frontend
COPY src/frontend/package*.json ./
RUN npm install
COPY src/frontend ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /workspace/src/backend
COPY src/backend/pom.xml ./
RUN mvn -q dependency:go-offline
COPY src/backend ./
COPY --from=frontend-build /workspace/src/frontend/dist ./src/main/resources/static
RUN mvn -q package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
ENV ATTACHMENTS_ROOT=/app/Attachments
ENV SQLITE_DB=/app/data/form_attachment.db
RUN mkdir -p /app/Attachments /app/data
COPY --from=backend-build /workspace/src/backend/target/form-attachment-practice-0.1.0.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
