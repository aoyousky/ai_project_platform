import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  actionRowFor,
  APP_ENTRY_TIMEOUT,
  fixedActionRow,
  gotoAppPath,
  isBackendUp,
  loginWithCaptcha,
} from './helpers';

/**
 * 按用户名搜索，并只等待这次搜索触发的列表响应（带 userName 参数）。
 * 页面挂载时也会请求列表；若只等任意一条响应，会在旧数据上取行号，
 * 重渲染后行号错位，操作按钮随之消失。
 */
async function searchUser(page: Page, userName: string) {
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: APP_ENTRY_TIMEOUT,
  });
  await page.getByPlaceholder('请输入用户名称').last().fill(userName);
  const loaded = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') {
      return false;
    }
    const url = new URL(response.url());
    return (
      url.pathname.endsWith('/system/user/list') &&
      url.searchParams.get('userName') === userName
    );
  });
  await page.getByRole('button', { name: /搜\s*索/ }).click();
  await loaded;
  await expect(page.locator('.vxe-loading.is--visible')).toHaveCount(0, {
    timeout: APP_ENTRY_TIMEOUT,
  });
}

/**
 * T019：用户全生命周期主链路（SPEC-002 A-12、A-05、A-07、A-08、A-14）。
 *
 * 依赖本地 Docker 后端栈与 REQ-001 登录页；栈未启动时整组跳过，
 * 不把环境缺失误报为功能失败。
 */
test.describe('系统管理 - 用户', () => {
  test.beforeAll(async () => {
    test.skip(
      !(await isBackendUp()),
      '本地后端栈未启动（deploy/docker compose up -d）',
    );
  });

  test('新增 → 编辑 → 分配角色 → 重置密码 → 启停 → 删除', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    await gotoAppPath(page, '/system/user');
    await expect(page.getByRole('button', { name: '新增' })).toBeVisible({
      timeout: APP_ENTRY_TIMEOUT,
    });

    const suffix = Date.now();
    const userName = `e2e_${suffix}`;
    const nickName = `E2E 用户 ${suffix}`;

    // 新增
    await page.getByRole('button', { name: '新增' }).click();
    const createDialog = page.getByRole('dialog', { name: '新增用户' });
    await expect(createDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await createDialog.getByPlaceholder('请输入用户名称').fill(userName);
    await createDialog.getByPlaceholder('请输入用户昵称').fill(nickName);
    await createDialog.getByPlaceholder('请输入用户密码').fill('E2e@123456');
    // 后端要求至少一个角色（SysUserBo.roleIds @Size(min=1)）
    await createDialog.getByRole('combobox', { name: '角色' }).click();
    await page.locator('.ant-select-item-option').first().click();

    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/user') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(200);

    // 列表刷新后按用户名称筛选
    await searchUser(page, userName);

    const row = page
      .locator('.vxe-table--main-wrapper .vxe-body--row', { hasText: userName });
    await expect(row).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    const actions = await fixedActionRow(page, userName);

    // 编辑昵称
    await actions.getByRole('button', { name: /修\s*改/ }).click();
    const editDialog = page.getByRole('dialog', { name: '修改用户' });
    await expect(editDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await editDialog.getByPlaceholder('请输入用户昵称').fill(`${nickName} 改`);
    const updated = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/user') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const updatedResponse = await updated;
    expect(updatedResponse.status()).toBe(200);

    // 分配角色（至少选择一个非内置角色）
    await actions.getByRole('button', { name: /分配角色/ }).click();
    await expect(page).toHaveURL(/\/system\/user-auth\/role\//);
    // 角色列表里可能有停用角色（后端 status='1' → 复选框 disabled），
    // 且列表异步加载；取第一个可勾选的角色，等它渲染出来。
    const firstRole = page
      .locator('input[type="checkbox"]:not([disabled])')
      .first();
    await expect(firstRole).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await firstRole.check();
    const authorized = page.waitForResponse(
      (response) =>
        response.url().includes('/system/user/authRole') &&
        response.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: /提\s*交/ }).click();
    const authorizedResponse = await authorized;
    expect(authorizedResponse.status()).toBe(200);

    // 回到用户页（授权页提交后也会跳转，先等页面挂载稳定再操作）
    await gotoAppPath(page, '/system/user');
    await expect(page.getByRole('button', { name: '新增' })).toBeVisible({
      timeout: APP_ENTRY_TIMEOUT,
    });
    await searchUser(page, userName);
    await expect(row).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });

    // 重置密码（请求必须带 isEncrypt 头）
    await actions.getByRole('button', { name: /重置密码/ }).click();
    const resetDialog = page.getByRole('dialog', { name: '重置密码' });
    await expect(resetDialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });
    await resetDialog.getByPlaceholder('请输入新密码').fill('E2e@654321');
    const reset = page.waitForRequest(
      (request) =>
        request.url().endsWith('/system/user/resetPwd') &&
        request.method() === 'PUT',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const resetRequest = await reset;
    // 传输层会移除内部开关 isEncrypt，改为发送 encrypt-key 头 + AES 密文
    const resetHeaders = resetRequest.headers();
    expect(
      Object.entries(resetHeaders).some(
        ([key, value]) => key.toLowerCase() === 'encrypt-key' && !!value,
      ),
    ).toBe(true);
    expect(resetRequest.postData() ?? '').not.toContain('E2e@654321');

    // 启停：切换状态开关，等待 changeStatus 成功
    const statusSwitch = row.locator('.ant-switch');
    const toggled = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/user/changeStatus') &&
        response.request().method() === 'PUT',
    );
    await statusSwitch.click();
    const toggledResponse = await toggled;
    expect(toggledResponse.status()).toBe(200);

    // 删除：勾选后批量删除
    await row.locator('.vxe-cell--checkbox .vxe-checkbox--icon').first().click();
    await page.getByRole('button', { name: /删\s*除/ }).first().click();
    await page.getByRole('button', { name: /确\s*定/ }).click();
    await expect(row).toHaveCount(0, { timeout: APP_ENTRY_TIMEOUT });
  });

  test('userId=1 不显示修改/删除/重置密码/分配角色入口（A-05）', async ({
    page,
  }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    await gotoAppPath(page, '/system/user');

    const adminRow = page
      .locator('.vxe-table--main-wrapper .vxe-body--row', { hasText: 'admin' })
      .first();
    await expect(adminRow).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });

    // 搜索框为空时列表可能还有 spec003_menu_admin 等含 admin 的账号，
    // 取第一行（userId=1 的 admin 在未过滤列表中排在最前）再映射到操作列。
    const adminActions = await actionRowFor(page, adminRow);
    await expect(
      adminActions.getByRole('button', { name: /修\s*改/ }),
    ).toHaveCount(0);
    await expect(
      adminActions.getByRole('button', { name: '删除' }),
    ).toHaveCount(0);
    await expect(
      adminActions.getByRole('button', { name: /重置密码/ }),
    ).toHaveCount(0);
    await expect(
      adminActions.getByRole('button', { name: /分配角色/ }),
    ).toHaveCount(0);
  });

  test('重复用户名失败提示且弹窗保留输入（E-03）', async ({ page }) => {
    await loginWithCaptcha(page);
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    await gotoAppPath(page, '/system/user');
    await page.getByRole('button', { name: '新增' }).click();
    const dialog = page.getByRole('dialog', { name: '新增用户' });
    await expect(dialog).toBeVisible({ timeout: APP_ENTRY_TIMEOUT });

    await dialog.getByPlaceholder('请输入用户名称').fill('admin');
    await dialog.getByPlaceholder('请输入用户昵称').fill('重复用户');
    await dialog.getByPlaceholder('请输入用户密码').fill('E2e@123456');
    // 后端 roleIds 有 @Size(min=1)，不选角色会先报“用户角色不能为空”，
    // 无法验证重复用户名的错误；先选一个角色。
    await dialog.getByRole('combobox', { name: '角色' }).click();
    await page.locator('.ant-select-item-option').first().click();

    // 提示 toast 默认 3s 消失，断言开始晚于消失会误报；用 MutationObserver
    // 在点击前开始记录所有出现过的 toast 文案，断言时只查记录。
    await page.evaluate(() => {
      const w = window as unknown as { __toasts: string[] };
      w.__toasts = [];
      const record = () => {
        for (const el of document.querySelectorAll(
          '.ant-message-notice-title, .ant-message-notice-content',
        )) {
          const text = el.textContent?.trim();
          if (text && !w.__toasts.includes(text)) {
            w.__toasts.push(text);
          }
        }
      };
      record();
      new MutationObserver(record).observe(document.body, {
        childList: true,
        subtree: true,
      });
    });

    const failed = page.waitForResponse(
      (response) =>
        response.url().endsWith('/system/user') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /确\s*认/ }).click();
    const failedResponse = await failed;
    const body = await failedResponse.json();

    expect(body.code).not.toBe(200);
    await expect
      .poll(async () =>
        page.evaluate(
          () => (window as unknown as { __toasts: string[] }).__toasts,
        ),
      )
      .toContain(body.msg);
    await expect(dialog.getByPlaceholder('请输入用户名称')).toHaveValue('admin');
  });

  test('无权限账号不渲染写操作按钮（A-07）', async ({ page }) => {
    // 账号由 `bash scripts/evals/seed_spec002.sh` 预置（仅 system:user:list）；
    // 环境变量用于指向其他无权限账号，未提供时用夹具默认值，避免整条用例被跳过。
    await loginWithCaptcha(
      page,
      process.env.E2E_LIMITED_USER ?? 'spec002_limited',
      process.env.E2E_LIMITED_PASSWORD ?? 'admin123',
    );
    await expect(page).toHaveURL(/\/index/, { timeout: APP_ENTRY_TIMEOUT });
    await gotoAppPath(page, '/system/user');

    await expect(page.getByRole('button', { name: '新增' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '导出' })).toHaveCount(0);
  });
});
