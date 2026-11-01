package com.aoyou.fixtures.bad.infrastructure;

import com.aoyou.fixtures.bad.interfaces.BadController;

/**
 * 违规夹具：infrastructure 反向依赖 interfaces，应被
 * {@code INFRASTRUCTURE_DOES_NOT_DEPEND_ON_INTERFACES} 捕获。
 */
public class BadRepository {

    private BadController controller;

    public void bind(BadController controller) {
        this.controller = controller;
    }
}
