package tasks

import (
	"math/rand"
	"sync"
	"time"
)

type ThreadRecord struct {
	ID         uint32
	Tag, Name  string
	TaskID     uint32
	Handle     uintptr
	Alive      bool
}

var (
	threadRegistry = map[uint32]ThreadRecord{}
	threadByTag    = map[string]uint32{}
	threadOrder    []uint32
	threadMu       sync.Mutex
	threadRndOn    bool
)

func createThread(rec ThreadRecord) uint32 {
	// Stores a new thread and returns its id
	threadMu.Lock()
	defer threadMu.Unlock()
	if !threadRndOn {
		rand.Seed(time.Now().UnixNano())
		threadRndOn = true
	}
	t := rec
	for {
		cand := uint32(rand.Intn(90000) + 10000)
		if _, ok := threadRegistry[cand]; !ok {
			t.ID = cand
			break
		}
	}
	threadRegistry[t.ID] = t
	if t.Tag != "" {
		threadByTag[t.Tag] = t.ID
	}
	threadOrder = append(threadOrder, t.ID)
	return t.ID
}

func readThread(id uint32, tag string) (bool, ThreadRecord) {
	// Finds a thread by id or tag
	threadMu.Lock()
	defer threadMu.Unlock()
	if id != 0 {
		if t, ok := threadRegistry[id]; ok {
			return true, t
		}
	}
	if tag != "" {
		if tid, ok := threadByTag[tag]; ok {
			if t, ok2 := threadRegistry[tid]; ok2 {
				return true, t
			}
		}
	}
	return false, ThreadRecord{}
}

func updateThread(id uint32, rec ThreadRecord) bool {
	// Updates a stored thread record
	threadMu.Lock()
	defer threadMu.Unlock()
	prev, ok := threadRegistry[id]
	if !ok {
		return false
	}
	t := rec
	t.ID = id
	if prev.Tag != "" && prev.Tag != t.Tag {
		if threadByTag[prev.Tag] == id {
			delete(threadByTag, prev.Tag)
		}
	}
	threadRegistry[id] = t
	if t.Tag != "" {
		threadByTag[t.Tag] = id
	}
	return true
}

func ThreadOrder() []uint32 {
	// Returns a copy of the thread order
	threadMu.Lock()
	defer threadMu.Unlock()
	return append([]uint32{}, threadOrder...)
}

func ReadThreadExport(id uint32) (bool, ThreadRecord) {
	// Reads a thread for callers outside this package
	return readThread(id, "")
}

func DeleteThreadExport(id uint32) bool {
	// Deletes a thread for callers outside this package
	return deleteThread(id)
}

func deleteThread(id uint32) bool {
	// Deletes a thread by id
	threadMu.Lock()
	defer threadMu.Unlock()
	t, ok := threadRegistry[id]
	if !ok {
		return false
	}
	if t.Tag != "" && threadByTag[t.Tag] == id {
		delete(threadByTag, t.Tag)
	}
	delete(threadRegistry, id)
	for i, x := range threadOrder {
		if x == id {
			threadOrder = append(threadOrder[:i], threadOrder[i+1:]...)
			break
		}
	}
	return true
}
