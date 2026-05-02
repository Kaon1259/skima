package io.skima.byteapp.repository;

import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByKakaoId(String kakaoId);
    List<User> findAllByRole(UserRole role);
}
