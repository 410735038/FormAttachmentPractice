package com.example.formattachment.model;

import java.util.List;

public record FormTabDto(
        String id,
        String name,
        List<FormRowDto> rows
) {
}
