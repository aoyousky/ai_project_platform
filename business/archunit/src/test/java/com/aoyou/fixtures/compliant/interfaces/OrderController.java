package com.aoyou.fixtures.compliant.interfaces;

import com.aoyou.fixtures.compliant.application.OrderAppService;

/**
 * 合规夹具：interfaces 只依赖 application，不直连 infrastructure。
 */
public class OrderController {

    private final OrderAppService orderAppService;

    public OrderController(OrderAppService orderAppService) {
        this.orderAppService = orderAppService;
    }

    public String get(String orderId) {
        return orderAppService.load(orderId).map(order -> order.orderId()).orElse("");
    }
}
