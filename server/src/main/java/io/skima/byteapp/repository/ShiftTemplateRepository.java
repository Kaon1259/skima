package io.skima.byteapp.repository;

import io.skima.byteapp.domain.ShiftTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShiftTemplateRepository extends JpaRepository<ShiftTemplate, Long> {

    List<ShiftTemplate> findAllByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    List<ShiftTemplate> findAllByActiveTrue();
}
