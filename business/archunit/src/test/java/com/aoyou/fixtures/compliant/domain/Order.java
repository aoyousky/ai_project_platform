package com.aoyou.fixtures.compliant.domain;

/**
 * 合规夹具：domain 层的普通领域对象，零框架依赖。
 *
 * <p>仅用于验证 ArchUnit 规则，不承载任何业务语义。
 */
public final class Order {

    private final String orderId;

    public Order(String orderId) {
        this.orderId = orderId;
    }

    public String orderId() {
        return orderId;
    }
}
