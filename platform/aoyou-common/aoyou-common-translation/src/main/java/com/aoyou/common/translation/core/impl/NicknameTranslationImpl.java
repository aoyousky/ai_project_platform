package com.aoyou.common.translation.core.impl;

import lombok.AllArgsConstructor;
import com.aoyou.common.core.service.UserService;
import com.aoyou.common.translation.annotation.TranslationType;
import com.aoyou.common.translation.constant.TransConstant;
import com.aoyou.common.translation.core.TranslationInterface;

/**
 * 用户昵称翻译实现
 *
 * @author may
 */
@AllArgsConstructor
@TranslationType(type = TransConstant.USER_ID_TO_NICKNAME)
public class NicknameTranslationImpl implements TranslationInterface<String> {

    private final UserService userService;

    @Override
    public String translation(Object key, String other) {
        if (key instanceof Long id) {
            return userService.selectNicknameById(id);
        } else if (key instanceof String ids) {
            return userService.selectNicknameByIds(ids);
        }
        return null;
    }
}
