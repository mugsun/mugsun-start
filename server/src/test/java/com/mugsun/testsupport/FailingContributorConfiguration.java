package com.mugsun.testsupport;

import io.spring.initializr.generator.project.ProjectDescription;
import io.spring.initializr.generator.project.ProjectGenerationConfiguration;
import io.spring.initializr.generator.project.contributor.ProjectContributor;

import org.springframework.context.annotation.Bean;

/**
 * 仅测试用（放在组件扫描范围之外，只通过 META-INF/spring.factories 进入生成上下文）：artifactId 为 {@code boom-fail} 时生成过程抛异常，用于验证 500 GENERATION_FAILED。
 */
@ProjectGenerationConfiguration
public class FailingContributorConfiguration {

	public static final String TRIGGER = "boom-fail";

	@Bean
	ProjectContributor failingContributor(ProjectDescription description) {
		return (projectRoot) -> {
			if (TRIGGER.equals(description.getArtifactId())) {
				throw new IllegalStateException("simulated template failure");
			}
		};
	}

}
