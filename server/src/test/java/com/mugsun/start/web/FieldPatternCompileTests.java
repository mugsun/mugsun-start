package com.mugsun.start.web;

import java.util.Map;
import java.util.regex.Pattern;

import com.mugsun.start.metadata.MugsunStartProperties.FieldRule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

class FieldPatternCompileTests {

	@Test
	@DisplayName("字段正则启动时预编译；写错的正则直接报错并指明配置项")
	void precompiles() {
		Map<String, Pattern> compiled = ProjectRequestValidator
			.compile(Map.of("groupId", new FieldRule("^[a-z]+$", null, null, null, null), "name",
					new FieldRule(null, 50, null, null, null)));
		assertThat(compiled).containsOnlyKeys("groupId");
		assertThat(compiled.get("groupId").matcher("abc").matches()).isTrue();
		assertThatIllegalStateException()
			.isThrownBy(() -> ProjectRequestValidator.compile(Map.of("groupId", new FieldRule("^[a-z+$", null, null, null, null))))
			.withMessageContaining("mugsun.start.fields.groupId.pattern");
	}

	@Test
	@DisplayName("推导包名与 initializr 一致：连字符换成 _、转小写")
	void derivedPackageName() {
		assertThat(ProjectRequestValidator.derivedPackageName("com.example.Shop-Admin")).isEqualTo("com.example.shop_admin");
		assertThat(ProjectRequestValidator.derivedPackageName("com.example.in-t")).isEqualTo("com.example.in_t");
	}

}
