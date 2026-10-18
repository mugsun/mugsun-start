package com.mugsun.start.web;

import java.util.List;
import java.util.Locale;

import io.spring.initializr.metadata.InitializrMetadataProvider;
import io.spring.initializr.web.project.ProjectGenerationInvoker;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

/**
 * 生成控制器、语言解析与 CORS。
 */
@Configuration(proxyBeanMethods = false)
public class WebConfiguration implements WebMvcConfigurer {

	/** 前端读取下载文件名、requestId 和限流等待时间需要这些响应头。 */
	public static final List<String> EXPOSED_HEADERS = List.of("Content-Disposition", RequestIds.HEADER,
			"Retry-After");

	private final CorsProperties cors;

	public WebConfiguration(CorsProperties cors) {
		this.cors = cors;
	}

	@Bean
	public ProjectGenerationInvoker<MugsunProjectRequest> mugsunProjectGenerationInvoker(ApplicationContext context,
			ProjectRequestValidator validator) {
		// 生成失败时清理临时目录（预览与 zip 共用）
		return new CleaningProjectGenerationInvoker<>(context, new MugsunProjectRequestConverter(validator));
	}

	/** 同类型 bean 存在时 initializr 的默认控制器不再注册（@ConditionalOnMissingBean）。 */
	@Bean
	public MugsunProjectGenerationController projectGenerationController(InitializrMetadataProvider metadataProvider,
			ProjectGenerationInvoker<MugsunProjectRequest> invoker, ErrorResponses errors, PreviewGuard guard) {
		return new MugsunProjectGenerationController(metadataProvider, invoker, errors, guard);
	}

	@Bean(DispatcherServlet.LOCALE_RESOLVER_BEAN_NAME)
	public LocaleResolver localeResolver() {
		AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
		resolver.setSupportedLocales(List.of(Locale.CHINESE, Locale.ENGLISH));
		resolver.setDefaultLocale(Locale.CHINESE);
		return resolver;
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(new GenerationContentTypeGuard()).addPathPatterns("/starter.zip", "/starter.tgz");
	}

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/**")
			.allowedOrigins(this.cors.allowedOrigins().toArray(String[]::new))
			.allowedMethods("GET", "POST", "OPTIONS")
			.allowedHeaders("*")
			.exposedHeaders(EXPOSED_HEADERS.toArray(String[]::new))
			.maxAge(1800);
	}

	@ConfigurationProperties("mugsun.start.cors")
	public record CorsProperties(List<String> allowedOrigins) {

		public CorsProperties {
			allowedOrigins = (allowedOrigins != null) ? allowedOrigins : List.of();
		}

	}

}
