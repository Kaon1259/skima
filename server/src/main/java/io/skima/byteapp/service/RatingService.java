package io.skima.byteapp.service;

import io.skima.byteapp.common.BusinessException;
import io.skima.byteapp.domain.MatchStatus;
import io.skima.byteapp.domain.Rating;
import io.skima.byteapp.domain.RatingDirection;
import io.skima.byteapp.domain.ShiftMatch;
import io.skima.byteapp.domain.User;
import io.skima.byteapp.dto.RatingCreateRequest;
import io.skima.byteapp.repository.RatingRepository;
import io.skima.byteapp.repository.ShiftMatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RatingService {

    private final RatingRepository ratingRepository;
    private final ShiftMatchRepository matchRepository;

    @Transactional
    public Rating rateByOwner(User owner, Long matchId, RatingCreateRequest req) {
        ShiftMatch match = loadCheckedOutMatch(matchId);
        if (!match.getShift().getCafe().getOwner().getId().equals(owner.getId())) {
            throw BusinessException.forbidden("본인 매장의 매칭만 평가할 수 있습니다");
        }
        if (ratingRepository.existsByMatchIdAndDirection(matchId, RatingDirection.OWNER_TO_WORKER)) {
            throw BusinessException.conflict("이미 평가한 매칭입니다");
        }

        Rating rating = Rating.builder()
                .match(match)
                .worker(match.getWorker())
                .owner(owner)
                .direction(RatingDirection.OWNER_TO_WORKER)
                .score(req.score())
                .willRehire(req.willRehire())
                .comment(req.comment())
                .build();
        return ratingRepository.save(rating);
    }

    @Transactional
    public Rating rateByWorker(User worker, Long matchId, RatingCreateRequest req) {
        ShiftMatch match = loadCheckedOutMatch(matchId);
        if (!match.getWorker().getId().equals(worker.getId())) {
            throw BusinessException.forbidden("본인 매칭만 평가할 수 있습니다");
        }
        if (ratingRepository.existsByMatchIdAndDirection(matchId, RatingDirection.WORKER_TO_OWNER)) {
            throw BusinessException.conflict("이미 평가한 매칭입니다");
        }

        Rating rating = Rating.builder()
                .match(match)
                .worker(worker)
                .owner(match.getShift().getCafe().getOwner())
                .direction(RatingDirection.WORKER_TO_OWNER)
                .score(req.score())
                .willRehire(req.willRehire())
                .comment(req.comment())
                .build();
        return ratingRepository.save(rating);
    }

    private ShiftMatch loadCheckedOutMatch(Long matchId) {
        ShiftMatch match = matchRepository.findById(matchId)
                .orElseThrow(() -> BusinessException.notFound("매칭을 찾을 수 없습니다"));
        if (match.getStatus() != MatchStatus.CHECKED_OUT) {
            throw BusinessException.conflict("근무가 끝난 매칭만 평가할 수 있습니다 (현재: " + match.getStatus() + ")");
        }
        return match;
    }

    @Transactional(readOnly = true)
    public List<Rating> findGivenByOwner(User owner) {
        return ratingRepository.findAllByOwnerIdAndDirection(owner.getId(), RatingDirection.OWNER_TO_WORKER);
    }

    @Transactional(readOnly = true)
    public List<Rating> findReceivedByWorker(User worker) {
        return ratingRepository.findAllByWorkerIdAndDirection(worker.getId(), RatingDirection.OWNER_TO_WORKER);
    }

    @Transactional(readOnly = true)
    public List<Rating> findGivenByWorker(User worker) {
        return ratingRepository.findAllByWorkerIdAndDirection(worker.getId(), RatingDirection.WORKER_TO_OWNER);
    }

    @Transactional(readOnly = true)
    public List<Rating> findReceivedByOwner(User owner) {
        return ratingRepository.findAllByOwnerIdAndDirection(owner.getId(), RatingDirection.WORKER_TO_OWNER);
    }
}
