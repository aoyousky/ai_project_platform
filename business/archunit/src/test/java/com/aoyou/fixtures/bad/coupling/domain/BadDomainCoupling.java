package com.aoyou.fixtures.bad.coupling.domain;

import com.aoyou.fixtures.bad.coupling.application.BadAppService;

/**
 * 违规夹具：domain 依赖 application，应被
 * {@code DOMAIN_DOES_NOT_DEPEND_ON_OUTER_LAYERS} 捕获。
 */
public class BadDomainCoupling {

    private final BadAppService appService;

    public BadDomainCoupling(BadAppService appService) {
        this.appService = appService;
    }
}
