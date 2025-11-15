package com.levantafia.repository;

import com.levantafia.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository for User entities.
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Find user by email (used for login).
     */
    Optional<User> findByEmail(String email);

    /**
     * Check if email already exists (for signup validation).
     */
    boolean existsByEmail(String email);

    /**
     * Find active user by email.
     */
    Optional<User> findByEmailAndActiveTrue(String email);
}
