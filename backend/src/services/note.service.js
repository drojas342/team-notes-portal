const Note = require('../models/Note');

const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE'];
const TITLE_MAX_LENGTH = 150;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function validateTitle(title) {
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    fail(400, 'El título es obligatorio');
  }
  if (title.trim().length > TITLE_MAX_LENGTH) {
    fail(400, 'El título no puede superar los 150 caracteres');
  }
}

function validateContent(content) {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    fail(400, 'El contenido es obligatorio');
  }
}

function validateStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    fail(400, 'El estado debe ser PENDING, IN_PROGRESS o DONE');
  }
}

function validatePosition(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(400, `${field} debe ser un número válido`);
  }
  if (value < 0) {
    fail(400, `${field} no puede ser negativo`);
  }
}

async function findNoteOrFail(id) {
  const note = await Note.findByPk(id);
  if (!note) {
    fail(404, 'Nota no encontrada');
  }
  return note;
}

async function listNotes() {
  return Note.findAll({
    order: [['id', 'ASC']],
  });
}

async function createNote({ title, content, status, position_x, position_y }) {
  validateTitle(title);
  validateContent(content);

  const safeStatus = status === undefined ? 'PENDING' : status;
  validateStatus(safeStatus);

  const safeX = position_x === undefined ? 0 : position_x;
  const safeY = position_y === undefined ? 0 : position_y;
  validatePosition(safeX, 'position_x');
  validatePosition(safeY, 'position_y');

  return Note.create({
    title: title.trim(),
    content: content.trim(),
    status: safeStatus,
    position_x: safeX,
    position_y: safeY,
  });
}

async function updateNote(id, { title, content, status, position_x, position_y }) {
  if (position_x !== undefined || position_y !== undefined) {
    fail(400, 'La posición solo puede modificarse mediante PATCH /api/notes/:id/position');
  }

  const note = await findNoteOrFail(id);
  const changes = {};

  if (title !== undefined) {
    validateTitle(title);
    changes.title = title.trim();
  }

  if (content !== undefined) {
    validateContent(content);
    changes.content = content.trim();
  }

  if (status !== undefined && status !== note.status) {
    validateStatus(status);
    changes.status = status;
  }

  if (Object.keys(changes).length === 0) {
    return note;
  }

  await note.update(changes);
  return note;
}

async function updatePosition(id, { position_x, position_y }) {
  if (position_x === undefined || position_y === undefined) {
    fail(400, 'position_x y position_y son obligatorios');
  }
  validatePosition(position_x, 'position_x');
  validatePosition(position_y, 'position_y');

  const note = await findNoteOrFail(id);
  await note.update({ position_x, position_y });
  return note;
}

async function deleteNote(id) {
  const note = await findNoteOrFail(id);
  await note.destroy();
}

module.exports = {
  listNotes,
  createNote,
  updateNote,
  updatePosition,
  deleteNote,
};
