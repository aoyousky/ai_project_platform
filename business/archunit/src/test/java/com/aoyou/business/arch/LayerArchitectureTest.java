package com.aoyou.business.arch;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 宪章 II（DDD 四层与依赖方向）的构建门禁。
 *
 * <p>只扫描 {@code com.aoyou.business}，平台模块（`platform/`）豁免。
 * 夹具（{@code com.aoyou.fixtures}）用于证明规则不是空转。
 */
class LayerArchitectureTest {

    private static final String[] FRAMEWORK_PACKAGES = {
        "org.springframework..",
        "com.baomidou..",
        "org.apache.ibatis..",
        "jakarta.persistence..",
        "org.hibernate..",
        "com.fasterxml.jackson..",
        "io.swagger.."
    };

    static final ArchRule DOMAIN_IS_FRAMEWORK_FREE = noClasses()
        .that().resideInAPackage("..domain..")
        .should().dependOnClassesThat().resideInAnyPackage(FRAMEWORK_PACKAGES)
        .because("domain 层必须零框架依赖（宪章 II）");

    static final ArchRule DOMAIN_DOES_NOT_DEPEND_ON_OUTER_LAYERS = noClasses()
        .that().resideInAPackage("..domain..")
        .should().dependOnClassesThat()
        .resideInAnyPackage("..application..", "..interfaces..", "..infrastructure..")
        .because("依赖方向为 interfaces → application → domain ← infrastructure");

    static final ArchRule APPLICATION_DOES_NOT_DEPEND_ON_INTERFACES = noClasses()
        .that().resideInAPackage("..application..")
        .should().dependOnClassesThat().resideInAPackage("..interfaces..")
        .because("application 不得反向依赖接口层");

    static final ArchRule INTERFACES_DOES_NOT_DEPEND_ON_INFRASTRUCTURE = noClasses()
        .that().resideInAPackage("..interfaces..")
        .should().dependOnClassesThat().resideInAPackage("..infrastructure..")
        .because("interfaces 只能依赖 application，不得直连实现");

    static final ArchRule INFRASTRUCTURE_DOES_NOT_DEPEND_ON_INTERFACES = noClasses()
        .that().resideInAPackage("..infrastructure..")
        .should().dependOnClassesThat().resideInAPackage("..interfaces..")
        .because("infrastructure 只实现 domain 接口，不得依赖接口层");

    private static final ArchRule[] ALL_RULES = {
        DOMAIN_IS_FRAMEWORK_FREE,
        DOMAIN_DOES_NOT_DEPEND_ON_OUTER_LAYERS,
        APPLICATION_DOES_NOT_DEPEND_ON_INTERFACES,
        INTERFACES_DOES_NOT_DEPEND_ON_INFRASTRUCTURE,
        INFRASTRUCTURE_DOES_NOT_DEPEND_ON_INTERFACES
    };

    @Test
    @DisplayName("业务模块当前代码满足四层依赖规则")
    void businessModulesRespectLayering() {
        JavaClasses classes = new ClassFileImporter().importPackages("com.aoyou.business");
        for (ArchRule rule : ALL_RULES) {
            rule.check(classes);
        }
    }

    @Test
    @DisplayName("合规夹具全部通过")
    void compliantFixturesPass() {
        JavaClasses classes = new ClassFileImporter().importPackages("com.aoyou.fixtures.compliant");
        for (ArchRule rule : ALL_RULES) {
            assertDoesNotThrow(() -> rule.check(classes), rule.getDescription());
        }
    }

    @Test
    @DisplayName("domain 引用 Spring 注解会被规则捕获")
    void domainFrameworkLeakIsDetected() {
        assertRuleViolated(DOMAIN_IS_FRAMEWORK_FREE, "com.aoyou.fixtures.bad.domain");
    }

    @Test
    @DisplayName("domain 依赖 application 会被规则捕获")
    void domainOuterLayerLeakIsDetected() {
        assertRuleViolated(DOMAIN_DOES_NOT_DEPEND_ON_OUTER_LAYERS, "com.aoyou.fixtures.bad.coupling.domain");
    }

    @Test
    @DisplayName("application 依赖 interfaces 会被规则捕获")
    void applicationInterfacesLeakIsDetected() {
        assertRuleViolated(APPLICATION_DOES_NOT_DEPEND_ON_INTERFACES, "com.aoyou.fixtures.bad.coupling.application");
    }

    @Test
    @DisplayName("interfaces 依赖 infrastructure 会被规则捕获")
    void interfacesInfrastructureLeakIsDetected() {
        assertRuleViolated(INTERFACES_DOES_NOT_DEPEND_ON_INFRASTRUCTURE, "com.aoyou.fixtures.bad.interfaces");
    }

    @Test
    @DisplayName("infrastructure 依赖 interfaces 会被规则捕获")
    void infrastructureInterfacesLeakIsDetected() {
        assertRuleViolated(INFRASTRUCTURE_DOES_NOT_DEPEND_ON_INTERFACES, "com.aoyou.fixtures.bad.infrastructure");
    }

    /**
     * 断言违规夹具确实被“目标规则本身”判为违规，而不是因为类解析失败等其它原因抛错。
     */
    private static void assertRuleViolated(ArchRule rule, String fixturePackage) {
        JavaClasses classes = new ClassFileImporter().importPackages(fixturePackage);
        AssertionError error = assertThrows(AssertionError.class, () -> rule.check(classes));
        String message = String.valueOf(error.getMessage());
        assertTrue(
            message.contains(rule.getDescription()),
            () -> "抛出的不是目标规则的违规，实际消息为: " + message);
    }
}
