# Seguridad

## Cómo reportar un problema

Si encuentras una vulnerabilidad, repórtala de forma privada desde la pestaña Security de este repositorio, con la opción "Report a vulnerability". Por favor no abras un issue público con los detalles.

## Alcance

Es una herramienta educativa que corre en el navegador. No tiene servidor, cuentas, almacenamiento ni datos personales, y lo que escribes en los campos no sale de tu equipo.

- Usa solo datos públicos. Las bandas de PD vienen de un proyecto con la base UCI Default of Credit Card Clients y no hay información de ningún banco.
- No carga nada de internet: sin CDN, sin fuentes externas, sin librerías. Una política CSP en el HTML limita scripts, estilos, imágenes y conexiones al mismo origen.
- El código no usa innerHTML, eval ni scripts en línea, y las entradas numéricas se validan con rangos. Pruebas automáticas revisan el HTML y los archivos de la página.
- El proyecto no tiene dependencias de ejecución. Pytest, que solo se usa en pruebas, está fijado a una versión y Dependabot lo revisa cada semana. Las acciones de GitHub están fijadas a un commit.
