package com.mugsun.start.metadata;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.mugsun.start.metadata.MugsunStartProperties.FieldRule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * G5：mugsun.start.fields 的键名、正则和长度在启动时校验。
 */
class FieldRuleStartupTests {

	private static List<String> check(Map<String, FieldRule> fields) {
		List<String> problems = new ArrayList<>();
		MetadataConsistency.fields(problems, fields);
		return problems;
	}

	@Test
	@DisplayName("现有键名与正则都通过")
	void knownKeysPass() {
		Map<String, FieldRule> fields = new LinkedHashMap<>();
		fields.put("groupId", new FieldRule("^[a-z]+$", null, true, null, null));
		fields.put("artifactId", new FieldRule("^[a-z][a-z0-9-]*$", 50, true, null, null));
		assertThat(check(fields)).isEmpty();
	}

	@Test
	@DisplayName("未知键名、写错的正则、非正的 max-length 都拒绝启动")
	void badRulesRejected() {
		Map<String, FieldRule> fields = new LinkedHashMap<>();
		fields.put("artifactid", new FieldRule(null, null, null, null, null));
		fields.put("groupId", new FieldRule("^[a-z+$", null, null, null, null));
		fields.put("name", new FieldRule(null, 0, null, null, null));
		List<String> problems = check(fields);
		assertThat(problems).hasSize(3);
		assertThat(problems.get(0)).contains("mugsun.start.fields.artifactid", "未知字段");
		assertThat(problems.get(1)).contains("mugsun.start.fields.groupId.pattern");
		assertThat(problems.get(2)).contains("mugsun.start.fields.name.max-length");
	}

}
