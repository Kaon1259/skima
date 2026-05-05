package io.skima.byteapp.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Configuration
public class SecurityConfig {

    /** prod 추가 허용 origin (콤마 구분). 기본은 dev local + LAN. */
    @Value("${app.cors.allowed-origin-patterns:}")
    private String extraOriginPatterns;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        // Expo 웹 dev: localhost:8081 / 19006 / 19000. LAN 폰은 CORS 무관 (브라우저 아님)
        List<String> patterns = new ArrayList<>(List.of(
                "http://localhost:*", "http://127.0.0.1:*", "http://192.168.*:*"));
        if (extraOriginPatterns != null && !extraOriginPatterns.isBlank()) {
            Arrays.stream(extraOriginPatterns.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .forEach(patterns::add);
        }

        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOriginPatterns(patterns);
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        cors.setAllowedHeaders(List.of("*"));
        cors.setAllowCredentials(true);
        cors.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(c -> c.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/error").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/kakao/**").permitAll()
                        .requestMatchers("/api/owner/**").hasRole("OWNER")
                        .requestMatchers("/api/worker/**").hasRole("WORKER")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/me").authenticated()
                        .requestMatchers("/api/cafes/**", "/api/workers/**").authenticated()
                        .anyRequest().authenticated()
                )
                .httpBasic(b -> {});
        return http.build();
    }
}
