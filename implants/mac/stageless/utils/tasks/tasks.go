package tasks

import (
	"math/rand"
	"sync"
	"time"
)

type TaskRecord struct {
	ID                         uint32
	Tag, CmdType, Host         string
	Input, Params, Mode        string
	Args, Raw, Name, Result    string
	Running, Done, PendingOut  bool
}

var (
	taskRegistry = map[uint32]TaskRecord{}
	taskByTag    = map[string]uint32{}
	taskOrder    []uint32
	taskMu       sync.Mutex
	taskRndOn    bool
)

func createTask(rec TaskRecord) uint32 {
	// Stores a new task and returns its id
	taskMu.Lock()
	defer taskMu.Unlock()
	if !taskRndOn {
		rand.Seed(time.Now().UnixNano())
		taskRndOn = true
	}
	t := rec
	for {
		cand := uint32(rand.Intn(90000) + 10000)
		if _, ok := taskRegistry[cand]; !ok {
			t.ID = cand
			break
		}
	}
	taskRegistry[t.ID] = t
	if t.Tag != "" {
		taskByTag[t.Tag] = t.ID
	}
	taskOrder = append(taskOrder, t.ID)
	return t.ID
}

func TaskCount() int {
	// Returns how many tasks are stored
	taskMu.Lock()
	defer taskMu.Unlock()
	return len(taskOrder)
}

func readTaskTakeInput(id uint32) (bool, TaskRecord) {
	// Reads a task and clears its input while it is running
	taskMu.Lock()
	defer taskMu.Unlock()
	t, ok := taskRegistry[id]
	if !ok {
		return false, TaskRecord{}
	}
	if t.Running {
		kept := t
		t.Input = ""
		taskRegistry[id] = t
		return true, kept
	}
	return true, t
}

func readTask(id uint32, tag string) (bool, TaskRecord) {
	// Finds a task by id or tag
	taskMu.Lock()
	defer taskMu.Unlock()
	if id != 0 {
		if t, ok := taskRegistry[id]; ok {
			return true, t
		}
	}
	if tag != "" {
		if tid, ok := taskByTag[tag]; ok {
			if t, ok2 := taskRegistry[tid]; ok2 {
				return true, t
			}
		}
	}
	return false, TaskRecord{}
}

func updateTask(id uint32, rec TaskRecord) bool {
	// Updates a stored task record
	taskMu.Lock()
	defer taskMu.Unlock()
	prev, ok := taskRegistry[id]
	if !ok {
		return false
	}
	t := rec
	t.ID = id
	if prev.Tag != "" && prev.Tag != t.Tag {
		if taskByTag[prev.Tag] == id {
			delete(taskByTag, prev.Tag)
		}
	}
	taskRegistry[id] = t
	if t.Tag != "" {
		taskByTag[t.Tag] = id
	}
	return true
}

func ReadTaskExport(id uint32, tag string) (bool, TaskRecord) {
	// Reads a task for callers outside this package
	return readTask(id, tag)
}

func DeleteTask(id uint32) bool {
	// Deletes a task by id
	taskMu.Lock()
	defer taskMu.Unlock()
	t, ok := taskRegistry[id]
	if !ok {
		return false
	}
	if t.Tag != "" && taskByTag[t.Tag] == id {
		delete(taskByTag, t.Tag)
	}
	delete(taskRegistry, id)
	for i, x := range taskOrder {
		if x == id {
			taskOrder = append(taskOrder[:i], taskOrder[i+1:]...)
			break
		}
	}
	return true
}
