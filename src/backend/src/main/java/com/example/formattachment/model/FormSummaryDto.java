package com.example.formattachment.model;

public record FormSummaryDto(
        String id,
        String formNo,
        String latestUpdater,
        String updatedAt
) {
}
