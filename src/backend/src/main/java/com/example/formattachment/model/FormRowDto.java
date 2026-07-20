package com.example.formattachment.model;

import java.util.List;

public record FormRowDto(
        String id,
        String tabId,
        String attId,
        String field1,
        String field2,
        String field3,
        String field4,
        String field5,
        String field6,
        String field7,
        String field8,
        String field9,
        String field10,
        List<AttachmentDto> attachments
) {
}
