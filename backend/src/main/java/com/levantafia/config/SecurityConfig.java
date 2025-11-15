package com.levantafia.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Security Configuration - Permissive for Development
 *
 * This configuration allows all requests without authentication.
 * CORS is enabled for local development.
 *
 * TODO: Add proper JWT authentication before production deployment
 */
@Slf4j
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        log.info("Configuring Security Filter Chain - Permitting all requests");

        http
                // Disable CSRF for API endpoints (required for POST/PUT/DELETE)
                .csrf(AbstractHttpConfigurer::disable)

                // Disable HTTP Basic authentication
                .httpBasic(AbstractHttpConfigurer::disable)

                // Disable form login
                .formLogin(AbstractHttpConfigurer::disable)

                // Enable CORS with custom configuration
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // Permit all requests without authentication
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                );

        log.info("Security configured: All endpoints permitted, CSRF disabled, CORS enabled");

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        log.info("Configuring CORS for local development");

        CorsConfiguration configuration = new CorsConfiguration();

        // Allow requests from frontend origins
        configuration.setAllowedOrigins(List.of(
                "http://localhost:3000",
                "http://localhost:5173"
        ));

        // Allow all HTTP methods
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));

        // Allow all headers
        configuration.setAllowedHeaders(List.of("*"));

        // Allow credentials (cookies, authorization headers)
        configuration.setAllowCredentials(true);

        // Cache preflight requests for 1 hour
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);

        return source;
    }
}
