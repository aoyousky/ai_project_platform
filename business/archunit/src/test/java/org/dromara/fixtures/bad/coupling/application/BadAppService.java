package org.dromara.fixtures.bad.coupling.application;

import org.dromara.fixtures.bad.interfaces.BadController;

/**
 * 违规夹具：application 反向依赖 interfaces，应被
 * {@code APPLICATION_DOES_NOT_DEPEND_ON_INTERFACES} 捕获。
 */
public class BadAppService {

    private BadController controller;

    public void bind(BadController controller) {
        this.controller = controller;
    }
}
