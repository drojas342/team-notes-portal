// Tablero de notas: visualización, creación, edición y eliminación.
// La verificación de sesión la realiza auth.js; aquí solo se consume la API.

const STATUS_BADGES = {
  PENDING: 'text-bg-warning',
  IN_PROGRESS: 'text-bg-primary',
  DONE: 'text-bg-success',
};

document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('board');
  if (!board) return;

  const newNoteBtn = document.getElementById('newNoteBtn');
  if (newNoteBtn) {
    newNoteBtn.addEventListener('click', openCreateNoteModal);
  }

  const createForm = document.getElementById('createNoteForm');
  if (createForm) {
    createForm.addEventListener('submit', handleCreateNote);
  }

  loadNotes();
  loadMetrics();
});

async function loadNotes() {
  showBoardLoading(true);
  hideBoardError();
  try {
    const data = await getNotes();
    renderNotes(data.notes || []);
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    showBoardError('No se pudieron cargar las notas.');
  } finally {
    showBoardLoading(false);
  }
}

function renderNotes(notes) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  const emptyMsg = document.getElementById('emptyNotes');
  if (emptyMsg) {
    emptyMsg.classList.toggle('d-none', notes.length > 0);
  }

  notes.forEach((note) => {
    board.appendChild(createNoteCard(note));
  });
}

function createNoteCard(note) {
  const card = document.createElement('div');
  card.className = 'card shadow-sm note-card';
  card.style.left = `${Number(note.position_x) || 0}px`;
  card.style.top = `${Number(note.position_y) || 0}px`;
  // Copia local: conserva position_x/position_y durante la edición.
  card._note = { ...note };
  card.addEventListener('pointerdown', (event) => startDrag(event, card));

  renderCardView(card);
  // Normalizar una sola vez cuando la tarjeta ya esté en el DOM con medidas reales.
  schedulePositionNormalization(card);
  return card;
}

// La medición requiere layout real: se difiere al siguiente frame, cuando el
// llamador (renderNotes/handleCreateNote) ya añadió la tarjeta al tablero.
function schedulePositionNormalization(card) {
  if (card._normalizeScheduled) return;
  card._normalizeScheduled = true;
  requestAnimationFrame(() => {
    normalizeCardPosition(card);
  });
}

// Normaliza la posición persistida contra el tablero actual.
// Como máximo un PATCH por tarjeta y solo si hubo corrección.
async function normalizeCardPosition(card) {
  if (!card.isConnected) return;
  const board = document.getElementById('board');
  if (!board) return;

  const left = parseFloat(card.style.left) || 0;
  const top = parseFloat(card.style.top) || 0;
  const pos = clampToBoard(board, card, left, top);

  // Posición válida: sin cambios visuales ni petición.
  if (pos.x === left && pos.y === top) return;

  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;

  try {
    await updateNotePosition(card._note.id, { position_x: pos.x, position_y: pos.y });
    // Sincronizar solo si el usuario no movió la tarjeta mientras tanto.
    if (
      card.isConnected &&
      parseFloat(card.style.left) === pos.x &&
      parseFloat(card.style.top) === pos.y
    ) {
      card._note.position_x = pos.x;
      card._note.position_y = pos.y;
    }
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    // Revertir a la última posición conocida del servidor y avisar en la tarjeta.
    card.style.left = `${Number(card._note.position_x) || 0}px`;
    card.style.top = `${Number(card._note.position_y) || 0}px`;
    const errorBox = card.querySelector('.alert');
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.classList.remove('d-none');
    }
  }
}

function renderCardView(card) {
  const note = card._note;
  card.innerHTML = '';

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('h5');
  title.className = 'card-title';
  title.textContent = note.title;

  const badge = document.createElement('span');
  badge.className = `badge ${STATUS_BADGES[note.status] || 'text-bg-secondary'}`;
  badge.textContent = note.status;

  const content = document.createElement('p');
  content.className = 'card-text';
  content.textContent = note.content;

  const errorBox = document.createElement('div');
  errorBox.className = 'alert alert-danger py-1 px-2 small d-none';
  errorBox.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'd-flex gap-2';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn btn-sm btn-outline-primary';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', () => enterEditMode(card));

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn-sm btn-outline-danger';
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.addEventListener('click', () => handleDeleteNote(card));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  body.appendChild(title);
  body.appendChild(badge);
  body.appendChild(content);
  body.appendChild(errorBox);
  body.appendChild(actions);
  card.appendChild(body);
}

function renderCardEdit(card) {
  const note = card._note;
  card.innerHTML = '';

  const body = document.createElement('div');
  body.className = 'card-body';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'form-control form-control-sm mb-2';
  titleInput.value = note.title;

  const contentInput = document.createElement('textarea');
  contentInput.className = 'form-control form-control-sm mb-2';
  contentInput.rows = 3;
  contentInput.value = note.content;

  const statusSelect = document.createElement('select');
  statusSelect.className = 'form-select form-select-sm mb-2';
  ['PENDING', 'IN_PROGRESS', 'DONE'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    if (value === note.status) option.selected = true;
    statusSelect.appendChild(option);
  });

  const errorBox = document.createElement('div');
  errorBox.className = 'alert alert-danger py-1 px-2 small d-none';
  errorBox.setAttribute('role', 'alert');

  const actions = document.createElement('div');
  actions.className = 'd-flex gap-2';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-sm btn-primary';
  saveBtn.textContent = 'Guardar';
  saveBtn.addEventListener('click', () =>
    handleSaveNote(card, {
      titleInput,
      contentInput,
      statusSelect,
      errorBox,
      saveBtn,
    })
  );

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-sm btn-secondary';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', () => renderCardView(card));

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  body.appendChild(titleInput);
  body.appendChild(contentInput);
  body.appendChild(statusSelect);
  body.appendChild(errorBox);
  body.appendChild(actions);
  card.appendChild(body);
}

async function enterEditMode(card) {
  // Sin peticiones de contenido: los cambios viven solo en el formulario hasta Guardar.
  renderCardEdit(card);
  // El formulario agranda la tarjeta: reajustar si excede el tablero.
  await fitCardInBoard(card);
}

// Reutiliza clampToBoard() midiendo la tarjeta ya renderizada en modo edición.
// Como máximo un PATCH por entrada a edición y solo si hubo ajuste.
async function fitCardInBoard(card) {
  const board = document.getElementById('board');
  if (!board) return;

  const left = parseFloat(card.style.left) || 0;
  const top = parseFloat(card.style.top) || 0;
  const pos = clampToBoard(board, card, left, top);

  // Ya cabe completa: sin cambios visuales ni petición.
  if (pos.x === left && pos.y === top) return;

  const prevX = Number(card._note.position_x) || 0;
  const prevY = Number(card._note.position_y) || 0;

  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;
  card._note.position_x = pos.x;
  card._note.position_y = pos.y;

  try {
    await updateNotePosition(card._note.id, { position_x: pos.x, position_y: pos.y });
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    // Se conserva el ajuste visual para poder editar, pero se revierte el
    // valor local para no afirmar una posición que el servidor no guardó.
    card._note.position_x = prevX;
    card._note.position_y = prevY;
    const errorBox = card.querySelector('.alert');
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.classList.remove('d-none');
    }
  }
}

async function handleSaveNote(card, refs) {
  const { titleInput, contentInput, statusSelect, errorBox, saveBtn } = refs;
  errorBox.classList.add('d-none');

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const status = statusSelect.value;

  if (!title || !content) {
    errorBox.textContent = 'El título y el contenido son obligatorios';
    errorBox.classList.remove('d-none');
    return;
  }

  saveBtn.disabled = true;
  try {
    // Solo contenido: nunca se envían position_x/position_y.
    const data = await updateNote(card._note.id, { title, content, status });
    card._note = { ...card._note, ...data.note };
    renderCardView(card);
    loadMetrics();
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    // Se mantiene el modo edición con los valores introducidos.
    errorBox.textContent = error.message;
    errorBox.classList.remove('d-none');
    saveBtn.disabled = false;
  }
}

async function handleDeleteNote(card) {
  if (!window.confirm('¿Está seguro de eliminar esta nota?')) {
    return;
  }

  try {
    await deleteNote(card._note.id);
    card.remove();
    updateEmptyMessage();
    loadMetrics();
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    const errorBox = card.querySelector('.alert');
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.classList.remove('d-none');
    } else {
      showBoardError(error.message);
    }
  }
}

function updateEmptyMessage() {
  const remaining = document.querySelectorAll('#board .note-card').length;
  const emptyMsg = document.getElementById('emptyNotes');
  if (emptyMsg) {
    emptyMsg.classList.toggle('d-none', remaining > 0);
  }
}

// ---- drag & drop ----
function startDrag(event, card) {
  // Solo botón principal y solo desde zonas no interactivas:
  // botones, inputs, textarea y selects nunca inician el arrastre.
  if (event.button !== 0) return;
  if (event.target.closest('input, textarea, select, button, a')) return;

  const board = document.getElementById('board');
  if (!board) return;

  event.preventDefault();

  const startX = event.clientX;
  const startY = event.clientY;
  const origLeft = parseFloat(card.style.left) || 0;
  const origTop = parseFloat(card.style.top) || 0;

  card.classList.add('dragging');

  function onMove(moveEvent) {
    const pos = clampToBoard(
      board,
      card,
      origLeft + (moveEvent.clientX - startX),
      origTop + (moveEvent.clientY - startY)
    );
    card.style.left = `${pos.x}px`;
    card.style.top = `${pos.y}px`;
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    card.classList.remove('dragging');

    const x = Math.round(parseFloat(card.style.left) || 0);
    const y = Math.round(parseFloat(card.style.top) || 0);
    saveCardPosition(card, x, y);
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

function clampToBoard(board, card, x, y) {
  const maxX = Math.max(0, board.clientWidth - card.offsetWidth);
  const maxY = Math.max(0, board.clientHeight - card.offsetHeight);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

async function saveCardPosition(card, x, y) {
  const prevX = Number(card._note.position_x) || 0;
  const prevY = Number(card._note.position_y) || 0;

  // Sin cambios: no se envía ninguna petición.
  if (x === prevX && y === prevY) return;

  try {
    // Un único PATCH al soltar la tarjeta, nunca durante el movimiento.
    await updateNotePosition(card._note.id, { position_x: x, position_y: y });
    card._note.position_x = x;
    card._note.position_y = y;
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    // Restaurar la posición anterior y mostrar el error en la tarjeta.
    card.style.left = `${prevX}px`;
    card.style.top = `${prevY}px`;
    const errorBox = card.querySelector('.alert');
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.classList.remove('d-none');
    }
  }
}

function openCreateNoteModal() {
  hideCreateError();
  const modalEl = document.getElementById('createNoteModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
}

async function handleCreateNote(event) {
  event.preventDefault();
  hideCreateError();

  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  const status = document.getElementById('noteStatus').value;

  if (!title || !content) {
    showCreateError('El título y el contenido son obligatorios');
    return;
  }

  // Posición inicial sencilla para no apilar todas las notas nuevas.
  const existing = document.querySelectorAll('#board .note-card').length;
  const offset = (existing % 10) * 24;

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const data = await createNote({
      title,
      content,
      status,
      position_x: 20 + offset,
      position_y: 20 + offset,
    });

    const modalEl = document.getElementById('createNoteModal');
    bootstrap.Modal.getInstance(modalEl).hide();
    event.target.reset();

    const board = document.getElementById('board');
    board.appendChild(createNoteCard(data.note));
    const emptyMsg = document.getElementById('emptyNotes');
    if (emptyMsg) emptyMsg.classList.add('d-none');
    loadMetrics();
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    showCreateError(error.message);
  } finally {
    submitBtn.disabled = false;
  }
}

function showBoardLoading(visible) {
  const loader = document.getElementById('boardLoading');
  if (loader) loader.classList.toggle('d-none', !visible);
}

// ---- métricas (calculadas por la Lambda, nunca en el frontend) ----
async function loadMetrics() {
  hideMetricsError();
  try {
    const res = await getDashboardMetrics();
    renderMetrics(res.data || {});
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      window.location.href = 'index.html';
      return;
    }
    showMetricsError('No se pudieron cargar las métricas.');
  }
}

function renderMetrics(data) {
  setMetric('metricTotal', data.total);
  setMetric('metricPending', data.pending);
  setMetric('metricInProgress', data.in_progress);
  setMetric('metricDone', data.done);
}

function setMetric(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = typeof value === 'number' ? value : '—';
}

function showMetricsError(message) {
  const box = document.getElementById('metricsError');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('d-none');
}

function hideMetricsError() {
  const box = document.getElementById('metricsError');
  if (!box) return;
  box.textContent = '';
  box.classList.add('d-none');
}

function showBoardError(message) {
  const box = document.getElementById('boardError');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('d-none');
}

function hideBoardError() {
  const box = document.getElementById('boardError');
  if (!box) return;
  box.textContent = '';
  box.classList.add('d-none');
}

function showCreateError(message) {
  const box = document.getElementById('createError');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('d-none');
}

function hideCreateError() {
  const box = document.getElementById('createError');
  if (!box) return;
  box.textContent = '';
  box.classList.add('d-none');
}
