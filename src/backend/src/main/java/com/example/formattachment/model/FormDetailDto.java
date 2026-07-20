package com.example.formattachment.model;

import java.util.List;

public record FormDetailDto(
        String id,
        String formNo,
        String latestUpdater,
        String updatedAt,
        List<FormTabDto> tabs
) {
}
