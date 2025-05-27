        .text
        .globl main

main:
        # prompt for dividend
        li   $v0, 4
        la   $a0, prompt1
        syscall
        li   $v0, 5
        syscall
        move $s0, $v0        # s0 = dividend

        # prompt for divisor
        li   $v0, 4
        la   $a0, prompt2
        syscall
        li   $v0, 5
        syscall
        move $s1, $v0        # s1 = divisor

        # record original signs
        slt  $t6, $s0, $zero  # t6 = 1 if dividend < 0
        slt  $t7, $s1, $zero  # t7 = 1 if divisor  < 0

        # make both positive
        bltz $s0, DivNeg
        j    AfterDivNeg
DivNeg:
        negu $s0, $s0
AfterDivNeg:
        bltz $s1, DivdNeg
        j    InitDiv
DivdNeg:
        negu $s1, $s1
InitDiv:

        # Optimized division loop
        li   $t0, 0         # remainder = 0
        li   $t1, 0         # quotient = 0
        li   $t2, 32        # counter = 32
        move $t3, $s0       # working dividend

DivLoop:
        sll  $t0, $t0, 1    # shift remainder left
        sll  $t3, $t3, 1    # shift dividend left
        srl  $t4, $t3, 31   # get MSB of dividend
        or   $t0, $t0, $t4  # add to remainder

        sub  $t4, $t0, $s1  # compare remainder with divisor
        bltz $t4, SkipSet   # if remainder < divisor, skip
        move $t0, $t4       # else subtract divisor
        ori  $t1, $t1, 1    # set quotient bit

SkipSet:
        sll  $t1, $t1, 1    # shift quotient left
        addi $t2, $t2, -1   # decrement counter
        bnez $t2, DivLoop   # continue if not done

        srl  $t1, $t1, 1    # adjust final quotient

        # fix remainder sign if needed
        bnez $t6, FixRem
        j    FixQuot
FixRem:
        negu $t0, $t0

        # fix quotient sign
FixQuot:
        xor  $t8, $t6, $t7
        bnez $t8, NegQuot
        j    PrintRes
NegQuot:
        negu $t1, $t1

PrintRes:
        # print quotient
        li   $v0, 4
        la   $a0, msg_q
        syscall
        li   $v0, 1
        move $a0, $t1
        syscall

        # newline
        li   $v0, 4
        la   $a0, newline
        syscall

        # print remainder
        li   $v0, 4
        la   $a0, msg_r
        syscall
        li   $v0, 1
        move $a0, $t0
        syscall

        # exit
        li   $v0, 10
        syscall

        .data
prompt1: .asciiz "Enter dividend: "
prompt2: .asciiz "Enter divisor:  "
msg_q:   .asciiz "Quotient = "
msg_r:   .asciiz "Remainder = "
newline: .asciiz "\n" 