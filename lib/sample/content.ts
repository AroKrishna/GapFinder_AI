// SAMPLE study material (original text written for this demo). It is uploaded into the
// user's own storage folder and processed by the real ingestion pipeline — nothing here
// is pre-chunked, pre-embedded or pre-scored.

export const SAMPLE_WORKSPACE = {
  name: "Operating Systems (Sample)",
  subject: "Operating Systems — Units 2 to 4",
  hours_per_day: 2,
  examInDays: 10,
};

export const SAMPLE_DOCUMENTS: { title: string; filename: string; mime: string; content: string }[] = [
  {
    title: "SAMPLE — OS Syllabus (Units 2–4)",
    filename: "os-syllabus.txt",
    mime: "text/plain",
    content: `SAMPLE SYLLABUS — OPERATING SYSTEMS (B.Tech, Semester IV)

UNIT 2 PROCESS MANAGEMENT AND CPU SCHEDULING
Process concept, process states and the process control block (PCB). Context switching. Scheduling criteria: CPU utilisation, throughput, turnaround time, waiting time and response time. Scheduling algorithms: First-Come First-Served (FCFS), Shortest Job First (SJF) and Shortest Remaining Time First (SRTF), Priority scheduling, Round Robin (RR) and multilevel queue scheduling. Important: numerical problems on Gantt charts, average waiting time and turnaround time are frequently asked in the examination.

UNIT 3 PROCESS SYNCHRONIZATION
The critical-section problem and its three requirements: mutual exclusion, progress and bounded waiting. Peterson's solution. Hardware support: test-and-set. Semaphores (counting and binary), mutex locks. Classic problems: producer-consumer (bounded buffer), readers-writers and dining philosophers. This unit carries high weightage.

UNIT 4 DEADLOCKS AND MEMORY MANAGEMENT
Deadlock characterisation: the four necessary conditions. Resource allocation graphs. Deadlock prevention, deadlock avoidance with the Banker's algorithm and the safe-state concept, deadlock detection and recovery. Memory management: contiguous allocation, internal and external fragmentation, paging, page tables, translation look-aside buffer (TLB), and page replacement algorithms (FIFO, Optimal, LRU) including Belady's anomaly.

EXAMINATION PATTERN
Part A: short answers on definitions. Part B: long answers, numericals on scheduling and the Banker's algorithm, and page-replacement traces.`,
  },
  {
    title: "SAMPLE — Notes: CPU Scheduling & Synchronization",
    filename: "os-notes-scheduling-sync.md",
    mime: "text/markdown",
    content: `# Unit 2: CPU Scheduling

## Processes and the PCB
A process is a program in execution. As it runs, a process moves between the new, ready, running, waiting and terminated states. The operating system represents each process with a process control block (PCB), which stores the process state, program counter, CPU registers, scheduling information, memory-management information and I/O status.

A context switch happens when the CPU switches from one process to another. The kernel saves the state of the old process in its PCB and loads the saved state of the new process. Context-switch time is pure overhead because the system does no useful work while switching.

## Scheduling Criteria
Turnaround time is the interval from the submission of a process to its completion. Waiting time is the total time a process spends in the ready queue. Response time is the time from submission until the first response is produced, which matters most for interactive systems. Throughput is the number of processes completed per unit time. A good scheduler maximises CPU utilisation and throughput while minimising turnaround, waiting and response time.

## First-Come First-Served (FCFS)
FCFS runs processes in the order they arrive and is non-preemptive. It is simple but can suffer from the convoy effect, where many short processes wait behind one long CPU-bound process, increasing the average waiting time.

Worked example: processes P1, P2 and P3 arrive at time 0 with burst times 24, 3 and 3 ms. Under FCFS in the order P1, P2, P3 the waiting times are 0, 24 and 27 ms, so the average waiting time is 17 ms. If the order were P2, P3, P1 the waiting times would be 6, 0 and 3 ms, giving an average of only 3 ms.

## Shortest Job First (SJF) and SRTF
SJF selects the process with the smallest next CPU burst. SJF is provably optimal: it gives the minimum average waiting time for a given set of processes. Its practical difficulty is that the length of the next CPU burst is not known in advance, so it is usually predicted using an exponential average of previous bursts. The preemptive version of SJF is called Shortest Remaining Time First (SRTF): a newly arrived process preempts the running one if its burst is shorter than the remaining time of the current process.

## Priority Scheduling
Each process is given a priority and the CPU is allocated to the highest-priority process. A major problem is starvation (indefinite blocking), where low-priority processes may never execute. The standard solution is aging: gradually increasing the priority of processes that wait in the system for a long time.

## Round Robin (RR)
Round Robin is designed for time-sharing systems. Each process gets a small unit of CPU time called the time quantum, typically 10 to 100 milliseconds. When the quantum expires the process is preempted and placed at the tail of the ready queue. If the quantum is very large, RR behaves like FCFS. If the quantum is very small, the overhead of frequent context switches dominates. A rule of thumb is that about 80 percent of CPU bursts should be shorter than the time quantum.

# Unit 3: Process Synchronization

## The Critical-Section Problem
A race condition occurs when several processes access and manipulate shared data concurrently and the outcome depends on the particular order in which the accesses take place. The critical section is the segment of code in which a process accesses shared data. Any solution to the critical-section problem must satisfy three requirements. Mutual exclusion: if one process is executing in its critical section, no other process can be executing in its critical section. Progress: if no process is in its critical section, the selection of the next process to enter cannot be postponed indefinitely. Bounded waiting: there is a limit on the number of times other processes can enter their critical sections after a process has requested entry and before that request is granted.

## Peterson's Solution
Peterson's solution is a classic software solution for two processes. It uses two shared variables: an integer turn and a boolean array flag. A process sets its own flag to true and gives the turn to the other process, then waits while the other process's flag is true and it is the other process's turn. Peterson's solution satisfies mutual exclusion, progress and bounded waiting, but it may not work on modern architectures that reorder memory operations.

## Semaphores
A semaphore S is an integer variable that is accessed only through two atomic operations: wait() and signal(). wait() decrements the semaphore and blocks the process if the value becomes negative; signal() increments it and wakes a waiting process if any. A counting semaphore can range over an unrestricted domain and is used to control access to a resource with a finite number of instances. A binary semaphore can only be 0 or 1 and behaves like a mutex lock. Incorrect use of semaphores, such as swapping the order of wait and signal, can violate mutual exclusion or cause deadlock.

## Bounded-Buffer (Producer-Consumer) Problem
In the bounded-buffer problem, producers insert items into a buffer of n slots and consumers remove them. The standard solution uses three semaphores: mutex initialised to 1 for mutual exclusion on the buffer, empty initialised to n to count empty slots, and full initialised to 0 to count full slots. The producer waits on empty then on mutex before inserting; the consumer waits on full then on mutex before removing.

## Dining Philosophers
Five philosophers sit at a round table with one chopstick between each pair. A philosopher needs both neighbouring chopsticks to eat. If every philosopher picks up the left chopstick at the same time, all of them wait forever for the right chopstick, which is a deadlock. Remedies include allowing at most four philosophers to sit at the table, picking up both chopsticks only if both are available, or using an asymmetric solution in which odd philosophers pick up the left chopstick first and even philosophers pick up the right first.`,
  },
  {
    title: "SAMPLE — Notes: Deadlocks & Memory Management",
    filename: "os-notes-deadlocks-memory.md",
    mime: "text/markdown",
    content: `# Unit 4: Deadlocks

## Necessary Conditions for Deadlock
A deadlock is a situation in which a set of processes are blocked because each process is holding a resource and waiting for a resource held by another process in the set. A deadlock can arise only if four conditions hold simultaneously. Mutual exclusion: at least one resource must be held in a non-sharable mode. Hold and wait: a process holds at least one resource while waiting to acquire additional resources held by others. No preemption: resources cannot be forcibly taken away; they are released only voluntarily. Circular wait: there is a set of waiting processes P0 to Pn such that each process waits for a resource held by the next, and Pn waits for a resource held by P0.

## Resource-Allocation Graph
A resource-allocation graph has process nodes and resource nodes. A request edge goes from a process to a resource, and an assignment edge goes from a resource to a process. If the graph contains no cycle, no deadlock exists. If each resource type has exactly one instance, a cycle implies a deadlock. If resource types have several instances, a cycle indicates only the possibility of a deadlock.

## Deadlock Prevention
Prevention ensures that at least one of the four necessary conditions can never hold. Hold and wait can be prevented by requiring a process to request all of its resources before it starts execution, although this leads to low resource utilisation and possible starvation. Circular wait can be prevented by imposing a total ordering of all resource types and requiring every process to request resources in increasing order of enumeration.

## Deadlock Avoidance and the Banker's Algorithm
Avoidance requires advance information about the maximum resources each process may request. A state is safe if the system can allocate resources to each process in some order, called a safe sequence, and still avoid deadlock. A safe state is never deadlocked, but an unsafe state may lead to deadlock. The Banker's algorithm uses the data structures Available, Max, Allocation and Need, where Need equals Max minus Allocation. When a process requests resources, the system pretends to allocate them and runs the safety algorithm; the request is granted only if the resulting state is safe.

Worked example: with Available = (3, 3, 2) and a process whose Need is (1, 2, 2), the process can finish because each element of its Need is less than or equal to Available. When it finishes it releases its Allocation, which is added to Available, and the safety algorithm continues with the remaining processes.

## Detection and Recovery
If neither prevention nor avoidance is used, the system can allow deadlocks to occur, detect them with a wait-for graph or a detection algorithm, and then recover. Recovery options are terminating processes, either all deadlocked processes or one at a time until the cycle is broken, or preempting resources from some processes and rolling them back.

# Memory Management

## Fragmentation
External fragmentation exists when enough total memory space exists to satisfy a request but it is not contiguous. Internal fragmentation is unused memory inside an allocated block, occurring when a process is given a block slightly larger than it requested. Compaction can solve external fragmentation by shuffling memory contents to place all free memory together, but only if relocation is dynamic.

## Paging
Paging divides physical memory into fixed-sized blocks called frames and logical memory into blocks of the same size called pages. Paging avoids external fragmentation, but it can still cause internal fragmentation in the last page of a process. Every logical address is divided into a page number and a page offset. The page number is used as an index into the page table, which contains the base address of each page in physical memory.

## Translation Look-aside Buffer (TLB)
Because the page table is kept in main memory, every data access would need two memory accesses. The translation look-aside buffer is a small, fast associative cache of page-table entries. On a TLB hit the frame number is available immediately; on a TLB miss the page table in memory must be consulted. The effective access time depends on the hit ratio: with a hit ratio of 80 percent and a memory access time of 100 ns, effective access time is 0.80 × 100 + 0.20 × 200 = 120 ns, ignoring TLB lookup time.

## Page Replacement Algorithms
When a page fault occurs and no frame is free, a victim page must be replaced. FIFO replaces the page that has been in memory the longest. FIFO suffers from Belady's anomaly: for some reference strings, increasing the number of frames increases the number of page faults. The Optimal algorithm replaces the page that will not be used for the longest period of time; it has the lowest possible page-fault rate but requires future knowledge, so it is used mainly as a benchmark. LRU (Least Recently Used) replaces the page that has not been used for the longest period of time. LRU is a stack algorithm and therefore does not suffer from Belady's anomaly.`,
  },
];
