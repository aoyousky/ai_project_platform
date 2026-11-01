package com.aoyou.fixtures.bad.interfaces;

import com.aoyou.fixtures.bad.infrastructure.BadRepository;

/**
 * 违规夹具：interfaces 直连 infrastructure，应被
 * {@code INTERFACES_DOES_NOT_DEPEND_ON_INFRASTRUCTURE} 捕获。
 */
public class BadController {

    private final BadRepository repository;

    public BadController(BadRepository repository) {
        this.repository = repository;
    }
}
