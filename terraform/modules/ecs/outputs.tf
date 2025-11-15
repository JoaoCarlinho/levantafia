# ==============================================================================
# ECS Module Outputs
# ==============================================================================

output "cluster_id" {
  description = "ECS cluster ID"
  value       = aws_ecs_cluster.main.id
}

output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  description = "ECS cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "backend_service_name" {
  description = "Backend ECS service name"
  value       = aws_ecs_service.backend.name
}

output "backend_service_id" {
  description = "Backend ECS service ID"
  value       = aws_ecs_service.backend.id
}

output "frontend_service_name" {
  description = "Frontend ECS service name"
  value       = aws_ecs_service.frontend.name
}

output "frontend_service_id" {
  description = "Frontend ECS service ID"
  value       = aws_ecs_service.frontend.id
}

output "backend_security_group_id" {
  description = "Backend security group ID"
  value       = aws_security_group.ecs_backend.id
}

output "frontend_security_group_id" {
  description = "Frontend security group ID"
  value       = aws_security_group.ecs_frontend.id
}

output "backend_task_definition_arn" {
  description = "Backend task definition ARN"
  value       = aws_ecs_task_definition.backend.arn
}

output "frontend_task_definition_arn" {
  description = "Frontend task definition ARN"
  value       = aws_ecs_task_definition.frontend.arn
}

output "backend_log_group_name" {
  description = "Backend CloudWatch log group name"
  value       = aws_cloudwatch_log_group.backend.name
}

output "frontend_log_group_name" {
  description = "Frontend CloudWatch log group name"
  value       = aws_cloudwatch_log_group.frontend.name
}
