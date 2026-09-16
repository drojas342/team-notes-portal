const noteService = require('../services/note.service');

function handleError(res, error) {
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? 'Error interno del servidor' : error.message,
  });
}

async function list(req, res) {
  try {
    const notes = await noteService.listNotes();
    return res.json({
      success: true,
      notes,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function create(req, res) {
  try {
    const { title, content, status, position_x, position_y } = req.body;
    const note = await noteService.createNote({ title, content, status, position_x, position_y });
    return res.status(201).json({
      success: true,
      message: 'Nota creada correctamente',
      note,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function update(req, res) {
  try {
    const { title, content, status, position_x, position_y } = req.body;
    const note = await noteService.updateNote(req.params.id, {
      title,
      content,
      status,
      position_x,
      position_y,
    });
    return res.json({
      success: true,
      message: 'Nota actualizada correctamente',
      note,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function updatePosition(req, res) {
  try {
    const { position_x, position_y } = req.body;
    const note = await noteService.updatePosition(req.params.id, { position_x, position_y });
    return res.json({
      success: true,
      message: 'Posición actualizada correctamente',
      note,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

async function remove(req, res) {
  try {
    await noteService.deleteNote(req.params.id);
    return res.json({
      success: true,
      message: 'Nota eliminada correctamente',
    });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  list,
  create,
  update,
  updatePosition,
  remove,
};
