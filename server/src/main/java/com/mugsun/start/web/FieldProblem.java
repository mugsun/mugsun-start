package com.mugsun.start.web;

/**
 * 一项参数问题。{@code reason} 是稳定的机器码（required、pattern、maxLength、keyword、unsupported、unknown、
 * notApplicable、requires、conflicts），{@code args} 用于拼本地化的 message。
 */
public record FieldProblem(String field, String reason, Object... args) {
}
