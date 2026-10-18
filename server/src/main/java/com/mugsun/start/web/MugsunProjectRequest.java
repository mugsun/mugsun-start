package com.mugsun.start.web;

import io.spring.initializr.web.project.WebProjectRequest;

/**
 * 生成请求，在 initializr 参数之外增加 {@code database}（一期只接受 postgresql）。
 */
public class MugsunProjectRequest extends WebProjectRequest {

	private String database;

	public String getDatabase() {
		return this.database;
	}

	public void setDatabase(String database) {
		this.database = database;
	}

}
