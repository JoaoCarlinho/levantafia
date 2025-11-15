# ==============================================================================
# Multi-stage Dockerfile for Levantafia Backend - Java 21 with Virtual Threads
# ==============================================================================
# Optimized for high-concurrency photo uploads (100+ concurrent uploads)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Stage - Maven Build
# ------------------------------------------------------------------------------
FROM maven:3.9.6-eclipse-temurin-21 AS build

WORKDIR /app

# Copy pom.xml first for better layer caching
COPY pom.xml .

# Download dependencies (cached unless pom.xml changes)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build application (skip tests for faster builds)
RUN mvn clean package -DskipTests -B

# ------------------------------------------------------------------------------
# Stage 2: Runtime Stage - Optimized JRE 21
# ------------------------------------------------------------------------------
FROM eclipse-temurin:21-jre-jammy

# Metadata
LABEL maintainer="levantafia"
LABEL description="Levantafia Photo Upload Backend - Java 21 with Virtual Threads"
LABEL version="1.0.0"

# Install curl for health checks
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r levantafia && \
    useradd -r -g levantafia -m -d /app levantafia

WORKDIR /app

# Copy JAR from build stage
COPY --from=build /app/target/*.jar app.jar

# Change ownership to non-root user
RUN chown -R levantafia:levantafia /app

# Switch to non-root user
USER levantafia

# Expose port
EXPOSE 8080

# JVM optimization flags for Virtual Threads and high-concurrency uploads
ENV JAVA_OPTS="-XX:+UseZGC \
               -XX:+ZGenerational \
               -XX:MaxRAMPercentage=60.0 \
               -XX:InitialRAMPercentage=40.0 \
               -XX:+UseStringDeduplication \
               -XX:+OptimizeStringConcat \
               -XX:+UseCompressedOops \
               -XX:+UseCompressedClassPointers \
               -Djava.security.egd=file:/dev/./urandom \
               -Dspring.backgroundpreinitializer.ignore=true"

# Health check for ECS
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Start application with JVM optimizations
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
