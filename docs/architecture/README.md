# RapidPhotoUpload - Architecture Documentation

**Project**: RapidPhotoUpload - AI-Assisted High-Volume Photo Upload System
**Architect**: BMAD BMM Architect Agent v6.0.0
**Date**: 2025-11-10
**Version**: 1.0

## Overview

This directory contains the complete architectural design for the RapidPhotoUpload system, a high-performance photo upload platform capable of handling 100 concurrent uploads while maintaining responsive user interfaces across web and mobile platforms.

## Quick Navigation

### 📋 Core Documents

1. **[Architecture Overview](./architecture_overview.md)** ⭐ START HERE
   - Executive summary
   - System context (C4 Level 1)
   - Container architecture (C4 Level 2)
   - Component design (C4 Level 3)
   - Architectural principles (DDD, CQRS, VSA)
   - Quality attributes
   - Deployment architecture

2. **[Implementation Guide](./implementation_guide.md)** 🚀 DEVELOPER GUIDE
   - 5-day implementation plan
   - Day-by-day tasks and deliverables
   - Code scaffolding and examples
   - Testing strategies
   - Deployment instructions

3. **[Data Architecture](./data_architecture.md)** 💾 DATABASE DESIGN
   - Database schema (PostgreSQL)
   - Entity relationships (ERD)
   - S3 storage strategy
   - Caching strategy (Redis)
   - Data access patterns
   - Consistency guarantees

### 🎯 Architecture Decision Records (ADRs)

Architecture decisions are documented in the [adr/](./adr/) directory:

1. **[ADR-001: Technology Stack Selection](./adr/001-technology-stack.md)**
   - Backend: Java + Spring Boot 3.x
   - Frontend Web: React + TypeScript + Vite
   - Frontend Mobile: React Native / Flutter
   - Database: PostgreSQL 15+
   - Storage: AWS S3 / Azure Blob Storage
   - Caching: Redis
   - Messaging: RabbitMQ / AWS SQS

2. **[ADR-002: Asynchronous Upload Strategy](./adr/002-async-upload-strategy.md)**
   - Direct client-to-S3 uploads via presigned URLs
   - Message queue for async post-processing
   - Thread pool concurrency strategy
   - WebSocket real-time updates
   - Retry and failure handling

## System Requirements

### Functional Requirements
- ✅ Support 100 concurrent photo uploads per user session
- ✅ Asynchronous, non-blocking UI (web + mobile)
- ✅ Real-time upload progress indicators
- ✅ Web interface for viewing, tagging, downloading photos
- ✅ Mobile app mirroring web functionality
- ✅ Cloud object storage (S3/Azure Blob)
- ✅ JWT-based authentication

### Non-Functional Requirements
- ✅ **Performance**: 100 uploads @ 2MB each in ≤ 90 seconds
- ✅ **Scalability**: Horizontal scaling for API and workers
- ✅ **Reliability**: Automatic retries, failure recovery
- ✅ **Security**: TLS, encryption at rest, presigned URLs
- ✅ **Maintainability**: Clean architecture, testable code

## Architecture Principles

### 1. Domain-Driven Design (DDD)
- Clear bounded contexts (Upload, Gallery, User)
- Rich domain models (Photo, UploadJob aggregates)
- Domain events for communication

### 2. CQRS (Command Query Responsibility Segregation)
- Separate command handlers (uploads, mutations)
- Separate query handlers (photo listing, status)
- Independent scaling and optimization

### 3. Vertical Slice Architecture (VSA)
- Feature-based organization
- Each slice contains full stack (controller → service → repository)
- Reduced coupling between features

## Technology Stack Summary

```
┌─────────────────────────────────────────────┐
│            Client Layer                     │
│  ┌────────────────┐  ┌──────────────────┐  │
│  │  Web App       │  │  Mobile App      │  │
│  │  React + TS    │  │  React Native    │  │
│  └────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         API Gateway Layer                   │
│         (Load Balancer)                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Application Layer                   │
│  ┌────────────────────────────────────────┐ │
│  │  Spring Boot API (Java 17+)           │ │
│  │  - WebFlux (Reactive)                 │ │
│  │  - Spring Data JPA                    │ │
│  │  - Spring AMQP                        │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Infrastructure Layer                │
│  ┌──────────┐  ┌────────┐  ┌────────────┐  │
│  │PostgreSQL│  │ Redis  │  │ RabbitMQ   │  │
│  │(Metadata)│  │(Cache) │  │  (Queue)   │  │
│  └──────────┘  └────────┘  └────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │  AWS S3 / Azure Blob Storage         │  │
│  │  (Binary File Storage)               │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Key Design Patterns

### Async Upload Flow
```
Client → API (init) → DB (create job) → Client (presigned URL)
  ↓
Client → S3 (direct upload)
  ↓
Client → API (complete) → Queue (publish event)
  ↓
Worker → S3 (verify) → DB (update) → WebSocket (notify)
```

### Concurrency Strategy
- **Thread Pool**: 100 worker threads for upload processing
- **Reactive Streams**: Spring WebFlux for non-blocking I/O
- **Message Queue**: Backpressure handling, elastic scaling
- **Direct S3 Upload**: Offload bandwidth from API server

### Caching Strategy
- **Redis**: Session data, photo metadata, presigned URLs
- **TTL**: 1 hour for photos, 5 minutes for listings, 14 minutes for presigned URLs
- **Invalidation**: Write-through cache with event-based invalidation

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| Concurrent uploads | 100 | Thread pool + queue |
| Upload time (100 @ 2MB) | ≤ 90 seconds | Direct S3 upload |
| API response time (p95) | < 200ms | Caching, read replicas |
| UI responsiveness | No freezing | Async operations, WebSocket |
| Upload success rate | > 99% | Retry logic, circuit breaker |

## Security Architecture

### Authentication & Authorization
- JWT-based stateless authentication
- Role-based access control (RBAC)
- Token refresh mechanism

### Data Protection
- **In Transit**: TLS 1.3 for all connections
- **At Rest**: S3 server-side encryption (SSE-S3)
- **Database**: PostgreSQL SSL, encrypted backups

### Access Control
- Presigned S3 URLs (15-minute expiry)
- Row-level security in PostgreSQL
- API rate limiting

## Deployment Strategy

### Development
```bash
docker-compose up -d  # PostgreSQL, Redis, RabbitMQ, LocalStack (S3)
./mvnw spring-boot:run  # Backend API
npm run dev  # Frontend (Vite)
```

### Production (AWS)
- **Compute**: EKS (Kubernetes) for API and workers
- **Database**: RDS PostgreSQL (Multi-AZ)
- **Cache**: ElastiCache Redis
- **Storage**: S3 with CloudFront CDN
- **Queue**: AWS SQS
- **Monitoring**: CloudWatch, Prometheus, Grafana

## Testing Strategy

### Test Pyramid
```
        /\
       /  \  E2E Tests (10%)
      /────\
     /      \  Integration Tests (30%)
    /────────\
   /          \  Unit Tests (60%)
  /────────────\
```

### Key Tests
1. **Unit Tests**: Domain logic, handlers, services
2. **Integration Tests**: Full upload flow, database operations
3. **Load Tests**: 100 concurrent uploads < 90s (JMeter)
4. **E2E Tests**: Web + mobile user journeys (Cypress, Detox)

## Monitoring & Observability

### Metrics
- Upload rate, queue depth, API latency
- Database connection pool, cache hit ratio
- S3 upload success/failure rates

### Logging
- Structured JSON logs with correlation IDs
- Centralized logging (ELK Stack or CloudWatch)

### Tracing
- Distributed tracing (Jaeger/Zipkin)
- Request flow visualization

### Alerting
- Database connection pool > 80%
- API error rate > 5%
- Upload failure rate > 1%
- Queue depth > 1000 messages

## Development Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Day 1**: Foundation | 8 hours | Project setup, domain models, database schema |
| **Day 2**: Core Upload | 8 hours | Upload endpoints, S3 integration, queue processing |
| **Day 3**: Frontends | 8 hours | Web app, mobile app, progress UI |
| **Day 4**: Testing | 8 hours | Integration tests, load tests, optimization |
| **Day 5**: Documentation & Demo | 8 hours | Technical writeup, demo video, deployment |

**Total**: 5 days (40 hours)

## Success Criteria

✅ **Functional**:
- All upload/view/download features working
- Web and mobile apps functional
- Authentication working

✅ **Performance**:
- 100 concurrent uploads complete in ≤ 90 seconds
- UI remains responsive during uploads
- API p95 latency < 200ms

✅ **Quality**:
- DDD, CQRS, VSA principles applied
- Integration tests pass
- Load tests pass
- Code follows clean architecture

✅ **Documentation**:
- Technical writeup complete
- API documentation (Swagger)
- Demo video/presentation

## Related Documents

### Internal Documentation
- [Architecture Overview](./architecture_overview.md)
- [Implementation Guide](./implementation_guide.md)
- [Data Architecture](./data_architecture.md)
- [ADR-001: Technology Stack](./adr/001-technology-stack.md)
- [ADR-002: Async Upload Strategy](./adr/002-async-upload-strategy.md)

### External References
- [Original PRD](../GOLD_%20Teamfront%20-%20RapidPhotoUpload.md)
- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [React Documentation](https://react.dev)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## Questions or Issues?

For questions about the architecture:
1. Review the [Architecture Overview](./architecture_overview.md)
2. Check the relevant ADR in [adr/](./adr/)
3. Consult the [Implementation Guide](./implementation_guide.md)

## License

This architecture documentation is part of the RapidPhotoUpload project.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-10
**Architect**: BMAD BMM Architect Agent v6.0.0
**Status**: Approved for Implementation
