package org.dromara.fixtures.bad.domain;

import org.springframework.stereotype.Service;

/**
 * 违规夹具：domain 层引用 Spring 注解，应被 {@code DOMAIN_IS_FRAMEWORK_FREE} 捕获。
 *
 * <p>本类永远不应出现在 {@code org.dromara.business} 下。
 */
@Service
public class BadDomainService {

    public String describe() {
        return "domain must stay framework free";
    }
}
