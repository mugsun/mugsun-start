package com.mugsun.start.web;

import java.io.IOException;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;

import io.spring.initializr.generator.project.DefaultProjectAssetGenerator;
import io.spring.initializr.generator.project.ProjectAssetGenerator;
import io.spring.initializr.generator.project.ProjectDescription;
import io.spring.initializr.generator.project.ProjectDirectoryFactory;
import io.spring.initializr.web.project.ProjectGenerationInvoker;
import io.spring.initializr.web.project.ProjectRequest;
import io.spring.initializr.web.project.ProjectRequestToDescriptionConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.context.ApplicationContext;
import org.springframework.util.FileSystemUtils;

/**
 * 生成失败时清掉已经建好的临时目录。
 * <p>initializr 先用 {@link ProjectDirectoryFactory} 建 {@code project-*} 临时目录、再逐个跑 contributor；
 * 任何 contributor 抛异常时，{@link ProjectGenerationInvoker#invokeProjectStructureGeneration} 直接把异常往外抛，
 * 调用方拿不到目录路径，也就没法 {@code cleanTempFiles}，目录就留在 {@code java.io.tmpdir} 里。
 * 这里在资产生成这一层记下新建的目录，失败时（{@code finally} 里判断）删除，再把原异常抛出。zip 与预览共用。
 */
public class CleaningProjectGenerationInvoker<R extends ProjectRequest> extends ProjectGenerationInvoker<R> {

	private static final Logger log = LoggerFactory.getLogger(CleaningProjectGenerationInvoker.class);

	public CleaningProjectGenerationInvoker(ApplicationContext parentApplicationContext,
			ProjectRequestToDescriptionConverter<R> requestConverter) {
		super(parentApplicationContext, requestConverter);
	}

	@Override
	protected ProjectAssetGenerator<Path> getProjectAssetGenerator(ProjectDescription description) {
		return (context) -> {
			ProjectDirectoryFactory factory = context.getBean(ProjectDirectoryFactory.class);
			AtomicReference<Path> created = new AtomicReference<>();
			ProjectAssetGenerator<Path> delegate = new DefaultProjectAssetGenerator((d) -> {
				Path dir = factory.createProjectDirectory(d);
				created.set(dir);
				return dir;
			});
			boolean ok = false;
			try {
				Path result = delegate.generate(context);
				ok = true;
				return result;
			}
			finally {
				if (!ok) {
					deleteQuietly(created.get());
				}
			}
		};
	}

	static void deleteQuietly(Path dir) {
		if (dir == null) {
			return;
		}
		try {
			FileSystemUtils.deleteRecursively(dir);
		}
		catch (IOException ex) {
			log.warn("failed to delete temp project directory {}", dir, ex);
		}
	}

}
