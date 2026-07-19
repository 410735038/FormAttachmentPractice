package com.example.formattachment.model;

import java.util.List;

public record SaveFormRequest(
        String id,
        List<FormRowDto> rows,
        List<Long> deletedAttachmentIds
) {
}
