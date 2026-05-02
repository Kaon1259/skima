package io.skima.byteapp.repository;

import io.skima.byteapp.domain.Cafe;
import io.skima.byteapp.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CafeRepository extends JpaRepository<Cafe, Long> {
    List<Cafe> findAllByOwner(User owner);
}
