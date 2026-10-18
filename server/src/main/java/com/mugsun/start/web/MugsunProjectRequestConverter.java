package com.mugsun.start.web;

import io.spring.initializr.generator.project.ProjectDescription;
import io.spring.initializr.metadata.InitializrMetadata;
import io.spring.initializr.web.project.DefaultProjectRequestToDescriptionConverter;
import io.spring.initializr.web.project.ProjectRequestToDescriptionConverter;

/**
 * 先做 mugsun 的校验，再交给 initializr 默认转换器。
 */
public class MugsunProjectRequestConverter implements ProjectRequestToDescriptionConverter<MugsunProjectRequest> {

	private final ProjectRequestValidator validator;

	private final DefaultProjectRequestToDescriptionConverter delegate = new DefaultProjectRequestToDescriptionConverter();

	public MugsunProjectRequestConverter(ProjectRequestValidator validator) {
		this.validator = validator;
	}

	@Override
	public ProjectDescription convert(MugsunProjectRequest request, InitializrMetadata metadata) {
		this.validator.validate(request, request.getDatabase());
		if (request.getDatabase() == null || request.getDatabase().isBlank()) {
			request.setDatabase(this.validator.databaseDefault());
		}
		return this.delegate.convert(request, metadata);
	}

}
