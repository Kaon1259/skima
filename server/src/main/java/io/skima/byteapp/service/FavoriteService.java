package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.Cafe;
import io.skima.byteapp.domain.OwnerFavoriteWorker;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.domain.UserRole;
import io.skima.byteapp.domain.WorkerFavoriteCafe;
import io.skima.byteapp.repository.CafeRepository;
import io.skima.byteapp.repository.OwnerFavoriteWorkerRepository;
import io.skima.byteapp.repository.UserRepository;
import io.skima.byteapp.repository.WorkerFavoriteCafeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** 점주 단골 워커 + 워커 즐겨찾기 매장 관리 — Phase 3 리텐션 코어 */
@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final OwnerFavoriteWorkerRepository ownerFavRepository;
    private final WorkerFavoriteCafeRepository workerFavRepository;
    private final UserRepository userRepository;
    private final CafeRepository cafeRepository;

    /* ========= 점주 — 단골 워커 ========= */

    @Transactional
    public boolean addOwnerFavorite(User owner, Long workerId) {
        if (owner.getRole() != UserRole.OWNER) {
            throw BusinessException.forbidden("점주만 단골 워커를 등록할 수 있습니다");
        }
        if (ownerFavRepository.existsByOwnerIdAndWorkerId(owner.getId(), workerId)) {
            return false; // 이미 등록됨
        }
        User worker = userRepository.findById(workerId)
                .orElseThrow(() -> BusinessException.notFound("워커를 찾을 수 없습니다"));
        if (worker.getRole() != UserRole.WORKER) {
            throw BusinessException.badRequest("워커만 단골로 등록할 수 있습니다");
        }
        ownerFavRepository.save(OwnerFavoriteWorker.builder()
                .owner(owner)
                .worker(worker)
                .build());
        return true;
    }

    @Transactional
    public boolean removeOwnerFavorite(User owner, Long workerId) {
        var fav = ownerFavRepository.findByOwnerIdAndWorkerId(owner.getId(), workerId);
        if (fav.isEmpty()) return false;
        ownerFavRepository.delete(fav.get());
        return true;
    }

    @Transactional(readOnly = true)
    public List<Long> ownerFavoriteWorkerIds(User owner) {
        return ownerFavRepository.findAllByOwnerIdOrderByCreatedAtDesc(owner.getId()).stream()
                .map(f -> f.getWorker().getId())
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isOwnerFavorite(User owner, Long workerId) {
        return ownerFavRepository.existsByOwnerIdAndWorkerId(owner.getId(), workerId);
    }

    /* ========= 워커 — 즐겨찾기 매장 ========= */

    @Transactional
    public boolean addWorkerFavorite(User worker, Long cafeId) {
        if (worker.getRole() != UserRole.WORKER) {
            throw BusinessException.forbidden("워커만 매장을 즐겨찾기할 수 있습니다");
        }
        if (workerFavRepository.existsByWorkerIdAndCafeId(worker.getId(), cafeId)) {
            return false;
        }
        Cafe cafe = cafeRepository.findById(cafeId)
                .orElseThrow(() -> BusinessException.notFound("매장을 찾을 수 없습니다"));
        workerFavRepository.save(WorkerFavoriteCafe.builder()
                .worker(worker)
                .cafe(cafe)
                .build());
        return true;
    }

    @Transactional
    public boolean removeWorkerFavorite(User worker, Long cafeId) {
        var fav = workerFavRepository.findByWorkerIdAndCafeId(worker.getId(), cafeId);
        if (fav.isEmpty()) return false;
        workerFavRepository.delete(fav.get());
        return true;
    }

    @Transactional(readOnly = true)
    public List<Long> workerFavoriteCafeIds(User worker) {
        return workerFavRepository.findAllByWorkerIdOrderByCreatedAtDesc(worker.getId()).stream()
                .map(f -> f.getCafe().getId())
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isWorkerFavorite(User worker, Long cafeId) {
        return workerFavRepository.existsByWorkerIdAndCafeId(worker.getId(), cafeId);
    }

    /** 단골 알림 전송용 — cafeId 를 즐겨찾기한 워커 id 목록 */
    @Transactional(readOnly = true)
    public List<Long> workerIdsFavoriting(Long cafeId) {
        return workerFavRepository.findWorkerIdsByCafeId(cafeId);
    }
}
