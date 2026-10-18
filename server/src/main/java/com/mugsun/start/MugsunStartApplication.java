package com.mugsun.start;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * start.mugsun.com 项目生成服务入口。
 * <p>生成能力来自 Spring Initializr（initializr-web + initializr-generator-spring），
 * 本服务只提供 mugsun 的元数据、请求校验与工程贡献者。
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class MugsunStartApplication {

	public static void main(String[] args) {
		SpringApplication.run(MugsunStartApplication.class, args);
	}
}
