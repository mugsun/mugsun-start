package com.mugsun.start.metadata;

import com.mugsun.start.MugsunStartApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * S2：{@code mugsun.start.*} 与 initializr 元数据不一致时启动失败。
 * <p>
 * 不要在这里关日志（logging.level.root=OFF）：Logback 是 JVM 级单例，会影响同一 JVM 里缓存的测试上下文。
 * 命令行参数中的列表下标会整体替换 yml 中的列表，因此每个用例只改 {@code optional[0]}。
 */
class MetadataConsistencyTests {

	@ParameterizedTest(name = "{0}")
	@DisplayName("配置错误时启动失败并指出问题")
	@CsvSource(delimiter = '|', textBlock = """
			可选模块 id 不在 initializr 中 | mugsun.start.optional[0].id=bogus           | bogus
			图标不在枚举中               | mugsun.start.optional[0].icon=globe          | globe
			图标重复                     | mugsun.start.optional[0].icon=system         | 模块图标重复
			appliesTo 含未知类型          | mugsun.start.optional[0].applies-to=gradle-project | gradle-project
			requires 指向自身             | mugsun.start.optional[0].requires[0]=gis     | requires/conflicts
			数据库默认值不在 values 中     | mugsun.start.database.default=mysql          | database.default
			类型缺英文描述               | mugsun.start.types[mugsun-backend].description.en= | mugsun.start.types.mugsun-backend.description 缺少中文或英文
			类型缺中文名称               | mugsun.start.types[mugsun-fullstack].name.zh=  | mugsun.start.types.mugsun-fullstack.name 缺少中文或英文
			可选模块缺英文描述           | mugsun.start.optional[0].description.en=     | 的 description 缺少中文或英文
			可选模块 notes 缺英文        | mugsun.start.optional[0].notes.backend-only.en= | notes.backend-only 缺少中文或英文
			数据库说明缺英文             | mugsun.start.database.note.en=               | mugsun.start.database.note 缺少中文或英文
			字段默认文案缺英文           | mugsun.start.fields[description].default-text.en= | mugsun.start.fields.description.default-text 缺少中文或英文
			""")
	void failsOnInconsistentConfiguration(String scenario, String property, String expected) {
		SpringApplicationBuilder app = new SpringApplicationBuilder(MugsunStartApplication.class)
			.web(WebApplicationType.NONE)
			.properties("spring.main.banner-mode=off");
		assertThatThrownBy(() -> app.run("--" + property)).hasRootCauseInstanceOf(IllegalStateException.class)
			.rootCause()
			.hasMessageContaining(expected);
	}

}
