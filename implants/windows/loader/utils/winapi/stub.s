.intel_syntax noprefix
.global SpoofStub

.section .text
SpoofStub:
    pop    rax

    mov    r10, rdi
    mov    r11, rsi

    mov    rdi, QWORD PTR [rsp + 32]
    mov    rsi, QWORD PTR [rsp + 40]

    mov    QWORD PTR [rdi + 24], r10
    mov    QWORD PTR [rdi + 88], r11
    mov    QWORD PTR [rdi + 96], r12
    mov    QWORD PTR [rdi + 104], r13
    mov    QWORD PTR [rdi + 112], r14
    mov    QWORD PTR [rdi + 120], r15

    mov    r12, rax

    xor    r11, r11
    mov    r13, QWORD PTR [rsp + 48]

    mov    r14, 0x200
    add    r14, 8
    add    r14, QWORD PTR [rdi + 56]
    add    r14, QWORD PTR [rdi + 48]
    add    r14, QWORD PTR [rdi + 32]
    sub    r14, 0x20

    mov    r10, rsp
    add    r10, 0x30

looping:
    xor    r15, r15
    cmp    r11d, r13d
    je     finish

    sub    r14, 8
    mov    r15, rsp
    sub    r15, r14

    add    r10, 8
    push   QWORD PTR [r10]
    pop    QWORD PTR [r15]

    add    r11, 1
    jmp    looping

finish:
    sub    rsp, 0x200

    push   0

    sub    rsp, QWORD PTR [rdi + 56]
    mov    r11, QWORD PTR [rdi + 64]
    mov    QWORD PTR [rsp], r11

    sub    rsp, QWORD PTR [rdi + 32]
    mov    r11, QWORD PTR [rdi + 40]
    mov    QWORD PTR [rsp], r11

    sub    rsp, QWORD PTR [rdi + 48]
    mov    r11, QWORD PTR [rdi + 80]
    mov    QWORD PTR [rsp], r11

    mov    r11, rsi

    mov    QWORD PTR [rdi + 8], r12
    mov    QWORD PTR [rdi + 16], rbx
    lea    rbx, [rip + fixup]
    mov    QWORD PTR [rdi], rbx
    mov    rbx, rdi

    mov    r10, rcx
    mov    rax, QWORD PTR [rdi + 72]

    jmp    r11

fixup:
    mov    rcx, rbx
    add    rsp, 0x200
    add    rsp, QWORD PTR [rbx + 48]
    add    rsp, QWORD PTR [rbx + 32]
    add    rsp, QWORD PTR [rbx + 56]

    mov    rbx, QWORD PTR [rcx + 16]
    mov    rdi, QWORD PTR [rcx + 24]
    mov    rsi, QWORD PTR [rcx + 88]
    mov    r12, QWORD PTR [rcx + 96]
    mov    r13, QWORD PTR [rcx + 104]
    mov    r14, QWORD PTR [rcx + 112]
    mov    r15, QWORD PTR [rcx + 120]
    push   rax
    xor    rax, rax
    pop    rax
    jmp    QWORD PTR [rcx + 8]
