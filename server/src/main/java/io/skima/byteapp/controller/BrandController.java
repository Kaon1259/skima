package io.skima.byteapp.controller;

import io.skima.byteapp.domain.CafeType;
import io.skima.byteapp.dto.BrandResponse;
import io.skima.byteapp.service.BrandCatalog;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/brands")
@RequiredArgsConstructor
public class BrandController {

    private final BrandCatalog catalog;

    @GetMapping
    public List<BrandResponse> list(@RequestParam(required = false) CafeType type) {
        return type == null ? catalog.all() : catalog.findByType(type);
    }
}
