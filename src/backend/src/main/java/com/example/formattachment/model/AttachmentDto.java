package com.example.formattachment.model;

public record AttachmentDto(
        Long id,
        String tempId,
        String attId,
        String fileName,
        long size,
        String contentType,
        String uploadedAt,
        String uploader,
        String status
) {
}
